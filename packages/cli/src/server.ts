import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname, delimiter } from "node:path";
import { existsSync, symlinkSync, lstatSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";
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

interface WebDirectoryResult {
  webDir: string;
  modulesDirs: string[];
}

function findWebDirectory(): WebDirectoryResult | null {
  const possiblePaths = [
    {
      webDir: resolve(__dirname, "..", "web", "apps", "web"),
      rootDir: resolve(__dirname, "..", "web"),
    },
    {
      webDir: resolve(__dirname, "..", "web"),
      rootDir: resolve(__dirname, "..", "web"),
    },
    {
      webDir: resolve(__dirname, "..", "..", "web"),
      rootDir: resolve(__dirname, "..", "..", "web"),
    },
    {
      webDir: resolve(
        __dirname,
        "..",
        "..",
        "..",
        "apps",
        "web",
        ".next",
        "standalone",
      ),
      rootDir: resolve(
        __dirname,
        "..",
        "..",
        "..",
        "apps",
        "web",
        ".next",
        "standalone",
      ),
    },
  ];

  for (const { webDir, rootDir } of possiblePaths) {
    const serverPath = resolve(webDir, "server.js");
    if (existsSync(serverPath)) {
      const modulesDirs = new Set<string>();
      const appModulesDir = resolve(webDir, "_modules");
      if (existsSync(appModulesDir)) {
        modulesDirs.add(appModulesDir);
      }
      const rootModulesDir = resolve(rootDir, "_modules");
      if (existsSync(rootModulesDir)) {
        modulesDirs.add(rootModulesDir);
      }
      return { webDir, modulesDirs: [...modulesDirs] };
    }
  }
  return null;
}

function ensureNodeModulesSymlink(modulesDir: string): void {
  const parentDir = resolve(modulesDir, "..");
  const nodeModulesPath = resolve(parentDir, "node_modules");

  try {
    if (existsSync(nodeModulesPath)) {
      const stats = lstatSync(nodeModulesPath);
      if (stats.isSymbolicLink() || stats.isDirectory()) {
        return;
      }
    }
    symlinkSync(
      "_modules",
      nodeModulesPath,
      platform() === "win32" ? "junction" : "dir",
    );
  } catch {}
}

export async function startWebServer(
  config: ServerConfig,
): Promise<ChildProcess | null> {
  const result = findWebDirectory();

  if (!result) {
    logError("Web application not found. The package may be corrupted.");
    logWarning("Expected to find server.js in the web directory.");
    return null;
  }

  const { webDir, modulesDirs } = result;

  for (const modulesDir of modulesDirs) {
    ensureNodeModulesSymlink(modulesDir);
  }

  log(`Starting web server on port ${config.port}...`);

  const serverPath = resolve(webDir, "server.js");
  const nodePathEntries = [...modulesDirs, process.env.NODE_PATH].filter(
    Boolean,
  );
  const nodePathEnv =
    nodePathEntries.length > 0 ? nodePathEntries.join(delimiter) : undefined;

  const proc = spawn("node", [serverPath], {
    cwd: webDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: config.port.toString(),
      HOSTNAME: "0.0.0.0",
      NODE_ENV: "production",
      ...(nodePathEnv ? { NODE_PATH: nodePathEnv } : {}),
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
