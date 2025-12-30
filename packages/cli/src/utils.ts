import { spawn, type ChildProcess } from "node:child_process";
import { platform } from "node:os";
import * as net from "node:net";

export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
} as const;

export function log(message: string): void {
  console.log(`${colors.cyan}[openportal]${colors.reset} ${message}`);
}

export function logSuccess(message: string): void {
  console.log(
    `${colors.green}[openportal]${colors.reset} ${colors.green}✓${colors.reset} ${message}`,
  );
}

export function logError(message: string): void {
  console.error(
    `${colors.red}[openportal]${colors.reset} ${colors.red}✗${colors.reset} ${message}`,
  );
}

export function logWarning(message: string): void {
  console.warn(
    `${colors.yellow}[openportal]${colors.reset} ${colors.yellow}⚠${colors.reset} ${message}`,
  );
}

export function logInfo(message: string): void {
  console.log(
    `${colors.blue}[openportal]${colors.reset} ${colors.blue}ℹ${colors.reset} ${message}`,
  );
}

export function execAsync(
  command: string,
  args: string[] = [],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      shell: platform() === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number | null) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on("error", () => {
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const childProcesses: Set<ChildProcess> = new Set();

export function trackProcess(proc: ChildProcess): void {
  childProcesses.add(proc);
  proc.on("exit", () => {
    childProcesses.delete(proc);
  });
}

export function killAllProcesses(): void {
  for (const proc of childProcesses) {
    try {
      proc.kill("SIGTERM");
    } catch {
      // ignored
    }
  }
  childProcesses.clear();
}

export function setupShutdownHandlers(cleanup: () => void): void {
  const shutdown = () => {
    log("Shutting down...");
    cleanup();
    killAllProcesses();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGHUP", shutdown);
}

export async function openBrowser(url: string): Promise<void> {
  const plat = platform();
  let command: string;
  let args: string[];

  if (plat === "darwin") {
    command = "open";
    args = [url];
  } else if (plat === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  try {
    spawn(command, args, {
      detached: true,
      stdio: "ignore",
    }).unref();
  } catch {
    logWarning(`Could not open browser. Please visit: ${url}`);
  }
}

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port, "127.0.0.1");
  });
}

export async function waitForService(
  url: string,
  timeoutMs: number = 30000,
  intervalMs: number = 500,
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return true;
      }
    } catch {
      // ignored
    }
    await sleep(intervalMs);
  }

  return false;
}
