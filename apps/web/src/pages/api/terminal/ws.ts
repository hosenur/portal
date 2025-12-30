import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "node:http";
import type { Socket as NetSocket } from "node:net";
import { Server as SocketIOServer } from "socket.io";
import * as pty from "node-pty";
import os from "node:os";

const WORKING_DIRECTORY =
  process.env.OPENCODE_WORKING_DIRECTORY || process.cwd();

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

function getShell(): string {
  if (os.platform() === "win32") {
    return "powershell.exe";
  }
  return process.env.SHELL || "/bin/bash";
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

      const shell = getShell();
      console.log("[Terminal] Spawning shell:", shell, "in", WORKING_DIRECTORY);

      let ptyProcess: pty.IPty | null = null;

      try {
        ptyProcess = pty.spawn(shell, [], {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd: WORKING_DIRECTORY,
          env: {
            ...process.env,
            TERM: "xterm-256color",
          },
        });

        console.log("[Terminal] PTY spawned, pid:", ptyProcess.pid);
        socket.emit("connected", {
          pid: ptyProcess.pid,
          cwd: WORKING_DIRECTORY,
        });

        ptyProcess.onData((data) => {
          socket.emit("output", data);
        });

        ptyProcess.onExit(({ exitCode, signal }) => {
          console.log("[Terminal] PTY exited:", exitCode, signal);
          socket.emit("disconnected", { exitCode, signal });
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("[Terminal] Failed to spawn PTY:", errMsg);
        socket.emit("error", {
          message: `Failed to spawn terminal: ${errMsg}`,
        });
        socket.disconnect();
        return;
      }

      socket.on("input", (data: string) => {
        if (ptyProcess) {
          ptyProcess.write(data);
        }
      });

      socket.on("resize", (data: { cols: number; rows: number }) => {
        if (ptyProcess && data.cols > 0 && data.rows > 0) {
          console.log("[Terminal] Resize:", data);
          ptyProcess.resize(data.cols, data.rows);
        }
      });

      socket.on("disconnect", (reason) => {
        console.log("[Terminal] Client disconnected:", reason);
        if (ptyProcess) {
          ptyProcess.kill();
          ptyProcess = null;
        }
      });
    });

    res.socket.server.io = io;
    console.log("[Terminal] Socket.IO server initialized");
  }

  res.end();
}
