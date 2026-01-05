#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "fs";
import { getPort } from "get-port-please";
import { homedir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(homedir(), ".portal.json");
const DEFAULT_HOSTNAME = "0.0.0.0";
const DEFAULT_PORT = 3000;
const DEFAULT_OPENCODE_PORT = 4000;

const WEB_SERVER_PATH = join(__dirname, "..", "web", "server", "index.mjs");

interface PortalInstance {
  id: string;
  name: string;
  directory: string;
  port: number | null;
  opencodePort: number;
  hostname: string;
  opencodePid: number;
  webPid: number | null;
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

function isProcessRunning(pid: number | null): boolean {
  if (pid === null) return false;
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

Usage: openportal [command] [options]

Commands:
  (default)       Start OpenCode server and Web UI
  run [options]   Start only OpenCode server (no Web UI)
  stop            Stop running instances
  list, ls        List running instances
  clean           Clean up stale entries

Options:
  -h, --help              Show this help message
  -d, --directory <path>  Working directory (default: current directory)
  -p, --port <port>       Web UI port (default: 3000)
  --opencode-port <port>  OpenCode server port (default: 4000)
  --hostname <host>       Hostname to bind (default: 0.0.0.0)
  --name <name>           Instance name

Examples:
  openportal                               Start OpenCode + Web UI
  openportal .                             Start OpenCode + Web UI in current dir
  openportal run                           Start only OpenCode server
  openportal run -d ./my-project           Start OpenCode in specific directory
  openportal --port 8080                   Use custom web UI port
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
      if (value !== undefined) {
        flags[key.toLowerCase()] = value;
      } else {
        const next = process.argv[i + 1];
        if (next && !next.startsWith("-")) {
          flags[key.toLowerCase()] = next;
          i++;
        } else {
          flags[key.toLowerCase()] = true;
        }
      }
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

async function startOpenCodeServer(
  directory: string,
  opencodePort: number,
  hostname: string,
): Promise<number> {
  console.log(`Starting OpenCode server...`);
  const proc = Bun.spawn(
    [
      "opencode",
      "serve",
      "--port",
      String(opencodePort),
      "--hostname",
      hostname,
    ],
    {
      cwd: directory,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    },
  );
  return proc.pid;
}

async function startWebServer(port: number, hostname: string): Promise<number> {
  console.log(`Starting Web UI server...`);
  const proc = Bun.spawn(["bun", "run", WEB_SERVER_PATH], {
    cwd: dirname(WEB_SERVER_PATH),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      HOST: hostname,
      NITRO_PORT: String(port),
      NITRO_HOST: hostname,
    },
  });
  return proc.pid;
}

async function cmdDefault(
  options: Record<string, string | boolean | undefined>,
) {
  const hostname = (options.hostname as string) || DEFAULT_HOSTNAME;
  const directory = resolve(
    (options.directory as string) || (options.d as string) || process.cwd(),
  );
  const name =
    (options.name as string) || directory.split("/").pop() || "opencode";
  const port =
    options.port || options.p
      ? parseInt((options.port as string) || (options.p as string), 10)
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
    if (
      isProcessRunning(existing.opencodePid) ||
      isProcessRunning(existing.webPid)
    ) {
      console.log(`OpenPortal is already running for this directory.`);
      console.log(`  Name: ${existing.name}`);
      console.log(`  Web UI Port: ${existing.port ?? "N/A"}`);
      console.log(`  OpenCode Port: ${existing.opencodePort}`);
      if (existing.port) {
        console.log(
          `\n📱 Access OpenPortal at http://localhost:${existing.port}`,
        );
      }
      console.log(
        `🔧 OpenCode API at http://localhost:${existing.opencodePort}`,
      );
      return;
    }
    config.instances.splice(existingIndex, 1);
  }

  if (!existsSync(WEB_SERVER_PATH)) {
    console.error(`❌ Web server not found at ${WEB_SERVER_PATH}`);
    console.error(`   The web app may not be bundled correctly.`);
    process.exit(1);
  }

  console.log(`Starting OpenPortal...`);
  console.log(`  Name: ${name}`);
  console.log(`  Directory: ${directory}`);
  console.log(`  Web UI Port: ${port}`);
  console.log(`  OpenCode Port: ${opencodePort}`);
  console.log(`  Hostname: ${hostname}`);

  try {
    const opencodePid = await startOpenCodeServer(
      directory,
      opencodePort,
      hostname,
    );
    const webPid = await startWebServer(port, hostname);

    const instance: PortalInstance = {
      id: generateId(),
      name,
      directory,
      port,
      opencodePort,
      hostname,
      opencodePid,
      webPid,
      startedAt: new Date().toISOString(),
    };

    config.instances.push(instance);
    writeConfig(config);

    console.log(`\n✅ OpenPortal started!`);
    console.log(`   OpenCode PID: ${opencodePid}`);
    console.log(`   Web UI PID: ${webPid}`);
    console.log(`\n📱 Access OpenPortal at http://localhost:${port}`);
    console.log(`🔧 OpenCode API at http://localhost:${opencodePort}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Failed to start OpenPortal: ${error.message}`);
    }
    process.exit(1);
  }
}

async function cmdRun(options: Record<string, string | boolean | undefined>) {
  const hostname = (options.hostname as string) || DEFAULT_HOSTNAME;
  const directory = resolve(
    (options.directory as string) || (options.d as string) || process.cwd(),
  );
  const name =
    (options.name as string) || directory.split("/").pop() || "opencode";
  const opencodePort = options["opencode-port"]
    ? parseInt(options["opencode-port"] as string, 10)
    : await getPort({ host: hostname, port: DEFAULT_OPENCODE_PORT });

  const config = readConfig();

  const existingIndex = config.instances.findIndex(
    (i) => i.directory === directory,
  );
  if (existingIndex !== -1) {
    const existing = config.instances[existingIndex];
    if (isProcessRunning(existing.opencodePid)) {
      console.log(`OpenCode is already running for this directory.`);
      console.log(`  Name: ${existing.name}`);
      console.log(`  OpenCode Port: ${existing.opencodePort}`);
      console.log(
        `🔧 OpenCode API at http://localhost:${existing.opencodePort}`,
      );
      return;
    }
    config.instances.splice(existingIndex, 1);
  }

  console.log(`Starting OpenCode server...`);
  console.log(`  Name: ${name}`);
  console.log(`  Directory: ${directory}`);
  console.log(`  OpenCode Port: ${opencodePort}`);
  console.log(`  Hostname: ${hostname}`);

  try {
    const opencodePid = await startOpenCodeServer(
      directory,
      opencodePort,
      hostname,
    );

    const instance: PortalInstance = {
      id: generateId(),
      name,
      directory,
      port: null,
      opencodePort,
      hostname,
      opencodePid,
      webPid: null,
      startedAt: new Date().toISOString(),
    };

    config.instances.push(instance);
    writeConfig(config);

    console.log(`\n✅ OpenCode server started!`);
    console.log(`   OpenCode PID: ${opencodePid}`);
    console.log(`🔧 OpenCode API at http://localhost:${opencodePort}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Failed to start OpenCode: ${error.message}`);
    }
    process.exit(1);
  }
}

function cmdStop(options: Record<string, string | boolean | undefined>) {
  const config = readConfig();
  const directory =
    options.directory || options.d
      ? resolve((options.directory as string) || (options.d as string))
      : process.cwd();

  const instance = options.name
    ? config.instances.find((i) => i.name === options.name)
    : config.instances.find((i) => i.directory === directory);

  if (!instance) {
    console.error("No instance found.");
    process.exit(1);
  }

  try {
    process.kill(instance.opencodePid, "SIGTERM");
    console.log(`Stopped OpenCode (PID: ${instance.opencodePid})`);
  } catch {
    console.log("OpenCode was already stopped.");
  }

  if (instance.webPid !== null) {
    try {
      process.kill(instance.webPid, "SIGTERM");
      console.log(`Stopped Web UI (PID: ${instance.webPid})`);
    } catch {
      console.log("Web UI was already stopped.");
    }
  }

  config.instances = config.instances.filter((i) => i.id !== instance.id);
  writeConfig(config);
  console.log(`\nStopped: ${instance.name}`);
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
    const opencodeRunning = isProcessRunning(instance.opencodePid);
    const webRunning = isProcessRunning(instance.webPid);

    let status = "stopped";
    if (opencodeRunning && webRunning) status = "running";
    else if (opencodeRunning) status = "opencode";
    else if (webRunning) status = "web only";

    if (opencodeRunning || webRunning) {
      validInstances.push(instance);
    }

    const portDisplay = instance.port ?? "-";
    console.log(
      `${instance.id}\t${instance.name.padEnd(16)}\t${String(portDisplay).padEnd(4)}\t${instance.opencodePort}\t\t${status.padEnd(12)}\t${instance.directory}`,
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
    if (
      isProcessRunning(instance.opencodePid) ||
      isProcessRunning(instance.webPid)
    ) {
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

  if (flags.help || flags.h) {
    printHelp();
    return;
  }

  const command = args[0]?.toLowerCase();

  if (
    !command ||
    command === "." ||
    command.startsWith("/") ||
    command.startsWith("./")
  ) {
    if (command && command !== ".") {
      flags.directory = command;
    }
    await cmdDefault(flags);
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
      if (existsSync(command)) {
        flags.directory = command;
        await cmdDefault(flags);
      } else {
        console.log(`Unknown command: ${command}`);
        console.log("Use --help to see available commands.");
        process.exit(1);
      }
  }
}

main();
