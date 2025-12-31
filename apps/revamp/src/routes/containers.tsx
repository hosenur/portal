import { createFileRoute, useNavigate } from "@tanstack/react-router";
import useSWR from "swr";
import {
  GridList,
  GridListItem,
  GridListEmptyState,
} from "@/components/ui/grid-list";
import { useContainerStore } from "@/stores/container-store";

export const Route = createFileRoute("/containers")({
  component: Index,
});

interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: Array<{ PrivatePort: number; PublicPort?: number; Type: string }>;
  mounts: Array<{
    source?: string;
    destination?: string;
    name?: string;
    type?: string;
  }>;
  created: string;
}

interface ContainersResponse {
  total: number;
  containers: Container[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
};

function getOpencodePort(container: Container): number | null {
  const opcodePort = container.ports.find((p) => p.PrivatePort === 4096);
  return opcodePort?.PublicPort ?? null;
}

function Index() {
  const navigate = useNavigate();
  const setContainer = useContainerStore((s) => s.setContainer);
  const { data: containers, error } = useSWR<ContainersResponse>(
    "/api/containers",
    fetcher,
  );

  const formatMount = (mount: Container["mounts"][number]) => {
    const value = mount.source ?? mount.destination ?? mount.name ?? "Unknown";
    if (value === "Unknown") {
      return "Unknown";
    }
    const normalized = value.replace(/\\+/g, "/").replace(/\/+$/g, "");
    const parts = normalized.split("/");
    return parts.at(-1) || value;
  };

  const handleSelect = (container: Container) => {
    const port = getOpencodePort(container);
    if (!port) return;

    setContainer({
      id: container.id,
      name: container.name,
      port,
    });
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {error && (
        <div className="rounded-md bg-danger-subtle p-3 text-danger-subtle-fg">
          {error instanceof Error
            ? error.message
            : "Failed to fetch containers"}
        </div>
      )}

      {containers ? (
        <GridList
          aria-label="Docker containers"
          items={containers.containers}
          className="gap-y-3"
          selectionMode="single"
          onAction={(key) => {
            const container = containers.containers.find((c) => c.id === key);
            if (container) handleSelect(container);
          }}
          renderEmptyState={() => (
            <GridListEmptyState className="text-center text-muted-fg">
              No OpenCode containers found
            </GridListEmptyState>
          )}
        >
          {(container) => {
            const mountLabel =
              container.mounts.length > 0
                ? container.mounts.map(formatMount).join(", ")
                : "No mounts";
            const port = getOpencodePort(container);
            const isRunning = container.state === "running";

            return (
              <GridListItem
                id={container.id}
                textValue={mountLabel}
                className="py-3 sm:py-4"
                isDisabled={!isRunning || !port}
              >
                <div className="flex items-center justify-between gap-4">
                  <span>{mountLabel}</span>
                  <span className="text-xs text-muted-fg">
                    {isRunning ? (port ? `:${port}` : "No port") : "Stopped"}
                  </span>
                </div>
              </GridListItem>
            );
          }}
        </GridList>
      ) : (
        <div className="py-8 text-center text-muted-fg">Loading...</div>
      )}
    </div>
  );
}
