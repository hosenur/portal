import { createFileRoute } from "@tanstack/react-router";
import useSWR from "swr";
import {
  GridList,
  GridListItem,
  GridListEmptyState,
} from "@/components/ui/grid-list";

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

function Index() {
  const {
    data: containers,
    error,
  } = useSWR<ContainersResponse>("/api/containers", fetcher);

  const formatMount = (mount: Container["mounts"][number]) => {
    const value = mount.source ?? mount.destination ?? mount.name ?? "Unknown";
    if (value === "Unknown") {
      return "Unknown";
    }
    const normalized = value.replace(/\\+/g, "/").replace(/\/+$/g, "");
    const parts = normalized.split("/");
    return parts.at(-1) || value;
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {error && (
        <div className="rounded-md bg-danger-subtle p-3 text-danger-subtle-fg">
          {error instanceof Error ? error.message : "Failed to fetch containers"}
        </div>
      )}

      {containers ? (
        <GridList
          aria-label="Docker containers"
          items={containers.containers}
          className="gap-y-3"
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

            return (
              <GridListItem
                id={container.id}
                textValue={mountLabel}
                className="py-3 sm:py-4"
              >
                {mountLabel}
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
