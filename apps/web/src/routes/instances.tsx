import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  GridList,
  GridListItem,
  GridListEmptyState,
} from "@/components/ui/grid-list";
import { useInstanceStore } from "@/stores/instance-store";
import { useInstances } from "@/hooks/use-opencode";
import IconBox from "@/components/icons/box-icon";
import { ServerIcon } from "@heroicons/react/24/solid";

export const Route = createFileRoute("/instances")(
  /*#__PURE__*/ {
    component: InstancesPage,
  },
);

interface InstanceData {
  id: string;
  name: string;
  directory: string;
  port: number;
  hostname: string;
  opencodePid: number;
  webPid: number;
  startedAt: string;
  state: "running";
  status: string;
}

function getDirectoryName(directory: string): string {
  const normalized = directory.replace(/\\+/g, "/").replace(/\/+$/g, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || directory;
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
          Select an active OpenCode instance to connect.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-danger-subtle p-3 text-danger-subtle-fg">
          {error instanceof Error ? error.message : "Failed to fetch instances"}
        </div>
      )}

      {data ? (
        <GridList
          aria-label="OpenCode instances"
          items={instances}
          className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2"
          selectionMode="single"
          onAction={(key) => {
            const instance = instances.find((i) => i.id === key);
            if (instance) handleSelect(instance);
          }}
          renderEmptyState={() => (
            <GridListEmptyState className="flex flex-col items-center gap-2 py-12 text-center text-muted-fg border border-dashed border-border/50 rounded-xl bg-muted/5">
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
            </GridListEmptyState>
          )}
        >
          {(instance) => {
            const dirName = getDirectoryName(instance.directory);
            const isRunning = instance.state === "running";

            return (
              <GridListItem
                id={instance.id}
                textValue={dirName}
                className="group relative flex cursor-default select-none items-center gap-4 rounded-xl border border-border/50 bg-bg p-4 shadow-sm outline-none transition-all hover:border-border hover:shadow-md hover:bg-muted/5 focus:ring-2 focus:ring-ring focus:ring-offset-2 data-[selected]:border-primary data-[selected]:ring-1 data-[selected]:ring-primary"
                isDisabled={!isRunning}
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 transition-colors group-hover:bg-orange-500/20">
                  <IconBox className="size-6" />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium tracking-tight truncate text-fg text-base">
                      {dirName}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-md bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-fg border border-border/50">
                        :{instance.port}
                      </span>
                      {isRunning && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-500">
                          <span className="relative flex size-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-fg truncate font-mono bg-muted/10 px-1.5 py-0.5 rounded w-fit max-w-full">
                    {instance.directory}
                  </span>
                </div>
              </GridListItem>
            );
          }}
        </GridList>
      ) : (
        <div className="py-12 text-center text-muted-fg">
          Loading instances...
        </div>
      )}
    </div>
  );
}
