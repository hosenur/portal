import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  log,
  logError,
  logSuccess,
  logWarning,
  trackProcess,
  waitForService,
  colors,
} from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ServerConfig {
  port: number;
  opencodePort: number;
  opencodeHost: string;
}

function findWebDirectory(): string | null {
  const possiblePaths = [
    resolve(__dirname, "..", "web"),
    resolve(__dirname, "..", "..", "web"),
    resolve(__dirname, "..", "..", "..", "apps", "web", ".next", "standalone"),
  ];

  for (const webPath of possiblePaths) {
    const serverPath = resolve(webPath, "server.js");
    if (existsSync(serverPath)) {
      return webPath;
    }
  }
  return null;
}

export async function startWebServer(
  config: ServerConfig,
): Promise<ChildProcess | null> {
  const webDir = findWebDirectory();

  if (!webDir) {
    logError("Web application not found. The package may be corrupted.");
    logWarning("Expected to find server.js in the web directory.");
    return null;
  }

  log(`Starting web server on port ${config.port}...`);

  const serverPath = resolve(webDir, "server.js");
  const proc = spawn("node", [serverPath], {
    cwd: webDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: config.port.toString(),
      HOSTNAME: "0.0.0.0",
      NODE_ENV: "production",
      OPENCODE_SERVER_URL: `http://${config.opencodeHost}:${config.opencodePort}`,
    },
  });

  trackProcess(proc);

  proc.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${colors.dim}[web]${colors.reset} ${line}`);
      }
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.error(`${colors.dim}[web]${colors.reset} ${line}`);
      }
    }
  });

  proc.on("error", (err) => {
    logError(`Failed to start web server: ${err.message}`);
  });

  proc.on("exit", (code) => {
    if (code !== null && code !== 0) {
      logWarning(`Web server exited with code ${code}`);
    }
  });

  const webUrl = `http://localhost:${config.port}`;
  const isReady = await waitForService(webUrl, 15000, 300);

  if (!isReady) {
    logError("Web server failed to start within 15 seconds");
    proc.kill("SIGTERM");
    return null;
  }

  logSuccess(`Web server is ready at ${webUrl}`);
  return proc;
}

export function stopWebServer(proc: ChildProcess): void {
  if (proc && !proc.killed) {
    log("Stopping web server...");
    proc.kill("SIGTERM");
  }
}
