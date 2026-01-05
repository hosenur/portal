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
    <div className="mx-auto w-full max-w-2xl space-y-8 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Instances</h1>
        <p className="text-muted-fg text-sm">
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
          className="gap-3"
          selectionMode="single"
          onAction={(key) => {
            const instance = instances.find((i) => i.id === key);
            if (instance) handleSelect(instance);
          }}
          renderEmptyState={() => (
            <GridListEmptyState className="flex flex-col items-center gap-2 py-12 text-center text-muted-fg">
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
                className="group relative flex cursor-default select-none items-center gap-4 rounded-lg border bg-bg p-4 shadow-xs outline-none transition-colors hover:bg-muted/50 focus:bg-accent focus:text-accent-fg data-[selected]:bg-accent data-[selected]:text-accent-fg"
                isDisabled={!isRunning}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-fg group-hover:bg-bg group-focus:bg-bg">
                  <IconBox className="size-5" />
                </div>
                <div className="flex flex-1 flex-col gap-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{dirName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-fg">
                        :{instance.port}
                      </span>
                      {isRunning && (
                        <span className="flex items-center gap-1.5 text-xs text-success">
                          <span className="size-1.5 rounded-full bg-success" />
                          Running
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-fg truncate font-mono">
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
