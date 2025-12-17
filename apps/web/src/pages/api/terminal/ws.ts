import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "node:http";
import type { Socket as NetSocket } from "node:net";
import { Server as SocketIOServer } from "socket.io";
import WebSocket from "ws";

// Environment variable for the Docker socket path
const DOCKER_HOST = process.env.DOCKER_HOST || "unix:///var/run/docker.sock";
const OPENCODE_CONTAINER =
  process.env.OPENCODE_CONTAINER || process.env.HOSTNAME || "";

console.log("[Terminal] Config:", {
  DOCKER_HOST,
  OPENCODE_CONTAINER,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

interface SocketServer extends HTTPServer {
  io?: SocketIOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface ResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

export default function handler(_req: NextApiRequest, res: ResponseWithSocket) {
  if (!res.socket.server.io) {
    console.log("[Terminal] Initializing Socket.IO server...");

    const io = new SocketIOServer(res.socket.server, {
      path: "/api/terminal/ws",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("[Terminal] Client connected:", socket.id);

      const containerId =
        (socket.handshake.query.containerId as string) || OPENCODE_CONTAINER;

      console.log("[Terminal] Using container ID:", containerId);

      if (!containerId) {
        console.log("[Terminal] Error: No container ID");
        socket.emit("error", {
          message:
            "Container ID is required. Set OPENCODE_CONTAINER env variable.",
        });
        socket.disconnect();
        return;
      }

      // Connect to Docker using attach WebSocket
      let dockerWs: WebSocket | null = null;

      const connectToDocker = () => {
        let url: string;

        if (DOCKER_HOST.startsWith("unix://")) {
          const socketPath = DOCKER_HOST.replace("unix://", "");
          url = `ws+unix://${socketPath}:/containers/${containerId}/attach/ws?stream=1&stdout=1&stderr=1&stdin=1`;
        } else {
          const host = DOCKER_HOST.replace(/^tcp:\/\//, "").replace(
            /^https?:\/\//,
            "",
          );
          url = `ws://${host}/containers/${containerId}/attach/ws?stream=1&stdout=1&stderr=1&stdin=1`;
        }

        console.log("[Terminal] Connecting to Docker:", url);
        socket.emit("log", "Connecting to container...");

        try {
          dockerWs = new WebSocket(url);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error("[Terminal] Failed to create WebSocket:", errMsg);
          socket.emit("error", {
            message: `Failed to create connection: ${errMsg}`,
          });
          return;
        }

        dockerWs.on("open", () => {
          console.log("[Terminal] Docker WebSocket connected");
          socket.emit("connected", { containerId });
        });

        dockerWs.on("message", (data: Buffer) => {
          socket.emit("output", data.toString());
        });

        dockerWs.on("close", (code, reason) => {
          console.log(
            "[Terminal] Docker WebSocket closed:",
            code,
            reason.toString(),
          );
          socket.emit("disconnected", { code, reason: reason.toString() });
        });

        dockerWs.on("error", (error: Error) => {
          console.error("[Terminal] Docker WebSocket error:", error.message);
          socket.emit("error", { message: error.message });
        });

        dockerWs.on("unexpected-response", (_req, res) => {
          console.error("[Terminal] Unexpected response:", res.statusCode);
          let body = "";
          res.on("data", (chunk: Buffer) => {
            body += chunk;
          });
          res.on("end", () => {
            console.error("[Terminal] Response body:", body);
            socket.emit("error", {
              message: `Docker returned ${res.statusCode}: ${body}`,
            });
          });
        });
      };

      // Handle input from client
      socket.on("input", (data: string) => {
        if (dockerWs && dockerWs.readyState === WebSocket.OPEN) {
          dockerWs.send(data);
        }
      });

      // Handle resize from client
      socket.on("resize", (data: { cols: number; rows: number }) => {
        console.log("[Terminal] Resize:", data);
        // Docker attach doesn't support resize via WebSocket
      });

      // Handle disconnect
      socket.on("disconnect", (reason) => {
        console.log("[Terminal] Client disconnected:", reason);
        if (dockerWs) {
          dockerWs.close();
          dockerWs = null;
        }
      });

      // Start connection
      connectToDocker();
    });

    res.socket.server.io = io;
    console.log("[Terminal] Socket.IO server initialized");
  }

  res.end();
}
