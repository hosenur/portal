import { spawn, type ChildProcess } from "node:child_process";
import { platform } from "node:os";
import {
  log,
  logError,
  logSuccess,
  logWarning,
  logInfo,
  execAsync,
  trackProcess,
  waitForService,
  colors,
} from "./utils.js";

export interface OpencodeConfig {
  port: number;
  directory: string;
  hostname: string;
}

async function findOpencodeCommand(): Promise<string | null> {
  const commands =
    platform() === "win32"
      ? ["opencode.cmd", "opencode.exe", "opencode"]
      : ["opencode"];

  for (const cmd of commands) {
    const whichCmd = platform() === "win32" ? "where" : "which";
    const result = await execAsync(whichCmd, [cmd]);
    if (result.exitCode === 0 && result.stdout.trim()) {
      return cmd;
    }
  }
  return null;
}

export async function checkOpencodeInstalled(): Promise<string | null> {
  const command = await findOpencodeCommand();
  if (!command) {
    return null;
  }

  const result = await execAsync(command, ["--version"]);
  if (result.exitCode === 0) {
    return result.stdout.trim();
  }
  return null;
}

export function printInstallInstructions(): void {
  logError("OpenCode is not installed or not in PATH");
  console.log("");
  console.log(`${colors.bold}To install OpenCode:${colors.reset}`);
  console.log("");

  if (platform() === "darwin") {
    console.log(`  ${colors.dim}# Using Homebrew${colors.reset}`);
    console.log(`  brew install opencode`);
    console.log("");
    console.log(`  ${colors.dim}# Or using curl${colors.reset}`);
    console.log(`  curl -fsSL https://opencode.ai/install | bash`);
  } else if (platform() === "win32") {
    console.log(`  ${colors.dim}# Using npm${colors.reset}`);
    console.log(`  npm install -g opencode`);
    console.log("");
    console.log(`  ${colors.dim}# Or using the installer${colors.reset}`);
    console.log(`  Visit https://opencode.ai for Windows installer`);
  } else {
    console.log(`  ${colors.dim}# Using curl${colors.reset}`);
    console.log(`  curl -fsSL https://opencode.ai/install | bash`);
    console.log("");
    console.log(`  ${colors.dim}# Or using npm${colors.reset}`);
    console.log(`  npm install -g opencode`);
  }

  console.log("");
  console.log(
    `${colors.dim}For more info: https://opencode.ai/docs${colors.reset}`,
  );
}

export async function startOpencodeServer(
  config: OpencodeConfig,
): Promise<ChildProcess | null> {
  const command = await findOpencodeCommand();
  if (!command) {
    printInstallInstructions();
    return null;
  }

  log(`Starting OpenCode server on port ${config.port}...`);

  const args = [
    "serve",
    "--port",
    config.port.toString(),
    "--hostname",
    config.hostname,
  ];

  const proc = spawn(command, args, {
    cwd: config.directory,
    stdio: ["ignore", "pipe", "pipe"],
    shell: platform() === "win32",
    env: {
      ...process.env,
      FORCE_COLOR: "1",
    },
  });

  trackProcess(proc);

  proc.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${colors.dim}[opencode]${colors.reset} ${line}`);
      }
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.error(`${colors.dim}[opencode]${colors.reset} ${line}`);
      }
    }
  });

  proc.on("error", (err) => {
    logError(`Failed to start OpenCode: ${err.message}`);
  });

  proc.on("exit", (code) => {
    if (code !== null && code !== 0) {
      logWarning(`OpenCode exited with code ${code}`);
    }
  });

  const apiUrl = `http://${config.hostname === "0.0.0.0" ? "localhost" : config.hostname}:${config.port}`;
  logInfo(`Waiting for OpenCode API at ${apiUrl}...`);

  const isReady = await waitForService(apiUrl, 30000, 500);
  if (!isReady) {
    logError("OpenCode server failed to start within 30 seconds");
    proc.kill("SIGTERM");
    return null;
  }

  logSuccess(`OpenCode server is ready at ${apiUrl}`);
  return proc;
}

export function stopOpencodeServer(proc: ChildProcess): void {
  if (proc && !proc.killed) {
    log("Stopping OpenCode server...");
    proc.kill("SIGTERM");
  }
}
