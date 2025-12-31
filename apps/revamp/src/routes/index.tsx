import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [apiResponse, setApiResponse] = useState("Not loaded yet.");
  const [loading, setLoading] = useState(false);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [wsResponse, setWsResponse] = useState("Waiting for WebSocket...");

  const handleClick = async () => {
    try {
      setLoading(true);
      const res = await fetch("/hello");
      const data = await res.json();
      setApiResponse(JSON.stringify(data));
    } catch (error) {
      setApiResponse(
        error instanceof Error ? error.message : "Failed to fetch /hello"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const url = new URL("/ws", window.location.href);
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

  return (
    <div className="card">
      <h2>Welcome home!</h2>
      <p>TanStack Router is set up and ready to route.</p>
      <button type="button" onClick={handleClick} disabled={loading}>
        {loading ? "Loading..." : "Fetch /hello"}
      </button>
      <p>API response: {apiResponse}</p>
      <p>
        WebSocket status: <strong>{wsStatus}</strong>
      </p>
      <p>WebSocket response: {wsResponse}</p>
    </div>
  );
}
