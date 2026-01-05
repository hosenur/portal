#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "fs";
import { getPort } from "get-port-please";
import { homedir } from "os";
import { join, resolve } from "path";

const CONFIG_PATH = join(homedir(), ".portal.json");
const DEFAULT_HOSTNAME = "0.0.0.0";
const DEFAULT_PORT = 3000;
const DEFAULT_OPENCODE_PORT = 4000;

interface PortalInstance {
  id: string;
  name: string;
  directory: string;
  port: number;
  opencodePort: number;
  hostname: string;
  pid: number;
  startedAt: string;
}

interface PortalConfig {
  instances: PortalInstance[];
}

function readConfig(): PortalConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return { instances: [] };
}

function writeConfig(config: PortalConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function printHelp() {
  console.log(`
OpenPortal CLI - Run OpenCode with a web UI

Usage: openportal [options] [command]

Options:
  -h, --help     Show this help message

Commands:
  run [options]   Start OpenCode and the web UI
  stop            Stop running instances
  list, ls        List running instances
  clean           Clean up stale entries

Examples:
  openportal run                           Start with default settings
  openportal run --port 8080               Use custom port
  openportal run --directory ./my-project  Serve specific directory
  openportal stop                          Stop running instances
  openportal list                          List running instances
`);
}

function parseArgs(): {
  args: string[];
  flags: Record<string, string | boolean | undefined>;
} {
  const args: string[] = [];
  const flags: Record<string, string | boolean | undefined> = {};

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith("--")) {
      const [key, value] = arg.substring(2).split("=");
      flags[key.toLowerCase()] = value ?? true;
    } else if (arg.startsWith("-")) {
      const short = arg.substring(1);
      const next = process.argv[i + 1];
      if (next && !next.startsWith("-")) {
        flags[short.toLowerCase()] = next;
        i++;
      } else {
        flags[short.toLowerCase()] = true;
      }
    } else {
      args.push(arg);
    }
  }

  return { args, flags };
}

async function cmdRun(options: Record<string, string | boolean | undefined>) {
  const hostname = (options.hostname as string) || DEFAULT_HOSTNAME;
  const directory = (options.directory as string) || process.cwd();
  const name =
    (options.name as string) || directory.split("/").pop() || "opencode";
  const port = options.port
    ? parseInt(options.port as string, 10)
    : await getPort({ host: hostname, port: DEFAULT_PORT });
  const opencodePort = options["opencode-port"]
    ? parseInt(options["opencode-port"] as string, 10)
    : await getPort({ host: hostname, port: DEFAULT_OPENCODE_PORT });

  const config = readConfig();

  const existingIndex = config.instances.findIndex(
    (i) => i.directory === directory,
  );
  if (existingIndex !== -1) {
    const existing = config.instances[existingIndex];
    if (isProcessRunning(existing.pid)) {
      console.log(`OpenPortal is already running for this directory.`);
      console.log(`  Name: ${existing.name}`);
      console.log(`  Port: ${existing.port}`);
      console.log(`  OpenCode Port: ${existing.opencodePort}`);
      console.log(`  PID: ${existing.pid}`);
      console.log(`\nAccess OpenPortal at http://localhost:${existing.port}`);
      return;
    }
    config.instances.splice(existingIndex, 1);
  }

  console.log(`Starting OpenPortal...`);
  console.log(`  Name: ${name}`);
  console.log(`  Directory: ${directory}`);
  console.log(`  Port: ${port}`);
  console.log(`  OpenCode Port: ${opencodePort}`);
  console.log(`  Hostname: ${hostname}`);

  try {
    const resolvedDir = resolve(directory);

    console.log(`\nStarting OpenCode server...`);
    const opencodeProc = Bun.spawn(
      [
        "opencode",
        "serve",
        "--port",
        String(opencodePort),
        "--hostname",
        hostname,
      ],
      {
        cwd: resolvedDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      },
    );

    const instance: PortalInstance = {
      id: generateId(),
      name,
      directory: resolvedDir,
      port,
      opencodePort,
      hostname,
      pid: opencodeProc.pid,
      startedAt: new Date().toISOString(),
    };

    config.instances.push(instance);
    writeConfig(config);

    console.log(`✅ OpenCode started. (PID: ${opencodeProc.pid})`);
    console.log(`\n📱 Access OpenPortal at http://localhost:${port}`);
    console.log(`🔧 OpenCode API at http://localhost:${opencodePort}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Failed to start OpenPortal: ${error.message}`);
    }
    process.exit(1);
  }
}

function cmdStop(options: Record<string, string | boolean | undefined>) {
  const config = readConfig();
  const directory = options.directory
    ? resolve(options.directory as string)
    : process.cwd();

  const instance = options.name
    ? config.instances.find((i) => i.name === options.name)
    : config.instances.find((i) => i.directory === directory);

  if (!instance) {
    console.error("No instance found.");
    process.exit(1);
  }

  try {
    process.kill(instance.pid, "SIGTERM");
    console.log(`Stopped: ${instance.name} (PID: ${instance.pid})`);
  } catch {
    console.log("Instance was already stopped.");
  }

  config.instances = config.instances.filter((i) => i.id !== instance.id);
  writeConfig(config);
}

function cmdList() {
  const config = readConfig();

  if (config.instances.length === 0) {
    console.log("No OpenPortal instances running.");
    return;
  }

  console.log("\nOpenPortal Instances:\n");
  console.log("ID\t\tNAME\t\t\tPORT\tOPENCODE\tSTATUS\t\tDIRECTORY");
  console.log("-".repeat(100));

  const validInstances: PortalInstance[] = [];

  for (const instance of config.instances) {
    const running = isProcessRunning(instance.pid);
    const status = running ? "running" : "stopped";

    if (running) {
      validInstances.push(instance);
    }

    console.log(
      `${instance.id}\t${instance.name.padEnd(16)}\t${instance.port}\t${instance.opencodePort}\t\t${status.padEnd(12)}\t${instance.directory}`,
    );
  }

  if (validInstances.length !== config.instances.length) {
    config.instances = validInstances;
    writeConfig(config);
  }
}

function cmdClean() {
  const config = readConfig();
  const validInstances: PortalInstance[] = [];

  for (const instance of config.instances) {
    if (isProcessRunning(instance.pid)) {
      validInstances.push(instance);
    } else {
      console.log(`Removed stale entry: ${instance.name}`);
    }
  }

  config.instances = validInstances;
  writeConfig(config);
  console.log(`\nConfig cleaned. ${validInstances.length} active instance(s).`);
}

async function main() {
  const { args, flags } = parseArgs();
  const command = args[0]?.toLowerCase() || "run";

  if (flags.help || flags.h) {
    printHelp();
    return;
  }

  switch (command) {
    case "run":
      await cmdRun(flags);
      break;
    case "stop":
      cmdStop(flags);
      break;
    case "list":
    case "ls":
      cmdList();
      break;
    case "clean":
      cmdClean();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log("Use --help to see available commands.");
      process.exit(1);
  }
}

main();
