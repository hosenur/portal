import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: Array<{ PrivatePort: number; PublicPort?: number; Type: string }>;
  created: string;
}

interface ContainersResponse {
  total: number;
  containers: Container[];
}

function Index() {
  const [containers, setContainers] = useState<ContainersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [wsResponse, setWsResponse] = useState("Waiting for WebSocket...");

  const fetchContainers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/containers");
      const data = await res.json();
      setContainers(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch containers",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  useEffect(() => {
    const url = new URL("/api/ws", window.location.origin);
    url.protocol = url.protocol.replace("http", "ws");

    const socket = new WebSocket(url.toString());

    const handleMessage = (event: MessageEvent) => {
      const raw =
        typeof event.data === "string" ? event.data : String(event.data);

      try {
        const parsed = JSON.parse(raw) as { message?: string };
        setWsResponse(parsed.message ?? raw);
      } catch {
        setWsResponse(raw);
      }
    };

    socket.addEventListener("open", () => {
      setWsStatus("open");
      socket.send("ping");
    });
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", () => setWsStatus("closed"));
    socket.addEventListener("error", () => setWsStatus("error"));

    return () => {
      socket.removeEventListener("message", handleMessage);
      socket.close();
    };
  }, []);

  const getStateIntent = (state: string) => {
    switch (state.toLowerCase()) {
      case "running":
        return "success";
      case "exited":
        return "danger";
      case "paused":
        return "warning";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="OpenCode Containers"
          description="Docker containers running ghcr.io/sst/opencode image"
        />
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <Button onPress={fetchContainers} isDisabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-fg">
              <span>WebSocket:</span>
              <Badge
                intent={
                  wsStatus === "open"
                    ? "success"
                    : wsStatus === "error"
                      ? "danger"
                      : "warning"
                }
              >
                {wsStatus}
              </Badge>
              <span className="text-xs">{wsResponse}</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-danger-subtle p-3 text-danger-subtle-fg">
              {error}
            </div>
          )}

          {containers && containers.total === 0 ? (
            <div className="py-8 text-center text-muted-fg">
              No OpenCode containers found
            </div>
          ) : containers ? (
            <Table aria-label="Docker containers">
              <TableHeader>
                <TableColumn isRowHeader>ID</TableColumn>
                <TableColumn>Name</TableColumn>
                <TableColumn>Image</TableColumn>
                <TableColumn>State</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Created</TableColumn>
              </TableHeader>
              <TableBody items={containers.containers}>
                {(container) => (
                  <TableRow id={container.id}>
                    <TableCell>
                      <code className="text-xs">{container.id}</code>
                    </TableCell>
                    <TableCell>{container.name}</TableCell>
                    <TableCell>
                      <code className="text-xs">{container.image}</code>
                    </TableCell>
                    <TableCell>
                      <Badge intent={getStateIntent(container.state)}>
                        {container.state}
                      </Badge>
                    </TableCell>
                    <TableCell>{container.status}</TableCell>
                    <TableCell>
                      {new Date(container.created).toLocaleString()}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-fg">Loading...</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
