import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useInstanceStore } from "@/stores/instance-store";
import { useInstances } from "@/hooks/use-opencode";
import {
  FolderIcon,
  GlobeAltIcon,
  ServerIcon,
} from "@/components/icons/lucide";
import { ProviderIcon } from "@/components/icons/provider-icon";
import type { BackendProvider } from "@/lib/backend-url";

export const Route = createFileRoute("/instances")(
  /*#__PURE__*/ {
    component: InstancesPage,
  },
);

interface InstanceData {
  id: string;
  name: string;
  provider?: BackendProvider;
  directory: string;
  port: number;
  hostname: string;
  opencodePid: number | null;
  webPid: number | null;
  startedAt: string | null;
  source?: "config" | "discovered";
  version?: string | null;
  sessionStats?: {
    count: number;
    hasMore: boolean;
    lastUpdatedAt: string | null;
  } | null;
  state: "running";
  status: string;
}

function getDirectoryName(directory: string): string {
  const normalized = directory.replace(/\\+/g, "/").replace(/\/+$/g, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || directory;
}

function formatDirectoryPath(directory: string): string {
  const normalized = directory.replace(/\\+/g, "/").replace(/\/+$/g, "");
  const homePath =
    normalized.match(/^\/Users\/[^/]+\/(.+)$/) ??
    normalized.match(/^\/home\/[^/]+\/(.+)$/) ??
    normalized.match(/^[A-Za-z]:\/Users\/[^/]+\/(.+)$/);

  if (homePath?.[1]) return homePath[1];
  if (normalized.startsWith("~/")) return normalized.slice(2);
  if (normalized.startsWith("/")) return normalized.slice(1) || "/";

  return normalized || directory;
}

function formatRelativeTime(value: string | null): string {
  if (!value) return "never";

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "unknown";

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(diffSeconds);

  if (absoluteSeconds < 60) return "just now";

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  });

  for (const [unit, secondsPerUnit] of units) {
    if (absoluteSeconds >= secondsPerUnit) {
      return formatter.format(Math.round(diffSeconds / secondsPerUnit), unit);
    }
  }

  return "just now";
}

function formatSessionCount(
  stats: NonNullable<InstanceData["sessionStats"]>,
): string {
  return `${stats.count.toLocaleString()}${stats.hasMore ? "+" : ""}`;
}

function formatSessionLabel(
  stats: NonNullable<InstanceData["sessionStats"]>,
): string {
  if (stats.count === 1 && !stats.hasMore) return "session";
  return "sessions";
}

function InstancesPage() {
  const navigate = useNavigate();
  const setInstance = useInstanceStore((s) => s.setInstance);
  const { data, error } = useInstances();

  const handleSelect = (instance: InstanceData) => {
    setInstance({
      id: instance.id,
      name: instance.name,
      port: instance.port,
      provider: instance.provider ?? "opencode",
    });
    navigate({ to: "/" });
  };

  const instances: InstanceData[] = data?.instances ?? [];

  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="bg-gradient-to-r from-fg to-muted-fg bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          Instances
        </h1>
        <p className="text-lg text-muted-fg">
          Select an active backend instance to connect.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-danger-subtle p-3 text-danger-subtle-fg">
          {error instanceof Error ? error.message : "Failed to fetch instances"}
        </div>
      )}

      {data ? (
        <div
          role="list"
          aria-label="OpenCode instances"
          className="grid gap-3 md:grid-cols-2"
        >
          {instances.length === 0 ? (
            <div className="col-span-full flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/50 bg-muted/5 py-8 text-center text-muted-fg">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted/50">
                <ServerIcon className="size-6 text-muted-fg/50" />
              </div>
              <p className="font-medium text-fg">No instances found</p>
              <p className="text-sm">
                Run{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  openportal run
                </code>{" "}
                in your project directory.
              </p>
            </div>
          ) : (
            instances.map((instance) => {
              const dirName = getDirectoryName(instance.directory);
              const directoryPath = formatDirectoryPath(instance.directory);
              const isRunning = instance.state === "running";
              const backendLabel =
                instance.provider === "claude"
                  ? "managed"
                  : `:${instance.port}`;

              return (
                <div key={instance.id} role="listitem" className="min-w-0">
                  <button
                    type="button"
                    className="group flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border/40 bg-bg text-left shadow-sm outline-none transition-colors hover:border-border hover:bg-muted/5 focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!isRunning}
                    onClick={() => handleSelect(instance)}
                  >
                    <div className="flex min-w-0 flex-col gap-1 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-base font-medium tracking-tight text-fg">
                          {dirName}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 rounded border border-border/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-fg">
                          <ProviderIcon
                            provider={instance.provider}
                            className="size-3"
                            aria-hidden="true"
                          />
                          {instance.provider ?? "opencode"}
                        </span>
                      </div>
                      <span
                        className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-fg"
                        title={instance.directory}
                      >
                        <FolderIcon
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">{directoryPath}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 border-t border-border/30 bg-muted/10 px-3 py-1.5 text-xs text-muted-fg">
                      {instance.sessionStats ? (
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="whitespace-nowrap">
                            <span className="font-medium tabular-nums text-fg">
                              {formatSessionCount(instance.sessionStats)}
                            </span>{" "}
                            {formatSessionLabel(instance.sessionStats)}
                          </span>
                          <span className="truncate tabular-nums">
                            Last{" "}
                            {formatRelativeTime(
                              instance.sessionStats.lastUpdatedAt,
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-fg">
                          Session stats unavailable
                        </span>
                      )}
                      <span className="ml-auto flex shrink-0 items-center gap-1.5 font-medium tabular-nums text-muted-fg">
                        <GlobeAltIcon className="size-3.5" aria-hidden="true" />
                        {backendLabel}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-fg">
          Loading instances...
        </div>
      )}
    </div>
  );
}
