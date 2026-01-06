#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "fs";
import { getPort } from "get-port-please";
import { homedir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getDockerClient,
  isContainerRunning,
  stopAndRemoveContainer,
  ensureImageExists,
  validateMountPath,
} from "./docker";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(homedir(), ".portal.json");
const DEFAULT_HOSTNAME = "0.0.0.0";
const DEFAULT_PORT = 3000;
const DEFAULT_OPENCODE_PORT = 4000;
const OPENCODE_DOCKER_IMAGE =
  process.env.OPENCODE_DOCKER_IMAGE || "ghcr.io/anomalyco/opencode:1.1.3";

const WEB_SERVER_PATH = join(__dirname, "..", "web", "server", "index.mjs");

type InstanceType = "process" | "docker";

interface PortalInstance {
  id: string;
  name: string;
  directory: string;
  port: number | null;
  opencodePort: number;
  hostname: string;
  opencodePid: number | null;
  webPid: number | null;
  startedAt: string;
  instanceType: InstanceType;
  containerId: string | null;
}

interface PortalConfig {
  instances: PortalInstance[];
}

function readConfig(): PortalConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      config.instances = config.instances.map((instance: PortalInstance) => ({
        ...instance,
        instanceType: instance.instanceType || "process",
        containerId: instance.containerId || null,
        opencodePid: instance.opencodePid ?? null,
        webPid: instance.webPid ?? null,
      }));
      return config;
    }
  } catch (error) {
    console.warn(
      `[config] Failed to read config file, using empty config:`,
      error instanceof Error ? error.message : error,
    );
  }
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

async function isInstanceRunning(instance: PortalInstance): Promise<boolean> {
  if (instance.instanceType === "docker") {
    return await isContainerRunning(instance.containerId);
  }
  return (
    isProcessRunning(instance.opencodePid) || isProcessRunning(instance.webPid)
  );
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
  --docker                Run OpenCode in a Docker container instead of locally

Environment Variables:
  OPENCODE_DOCKER_IMAGE   Docker image to use (default: ghcr.io/anomalyco/opencode:1.1.3)
  DOCKER_HOST             Docker daemon connection (e.g., tcp://localhost:2375)

Examples:
  openportal                               Start OpenCode + Web UI
  openportal .                             Start OpenCode + Web UI in current dir
  openportal run                           Start only OpenCode server
  openportal run -d ./my-project           Start OpenCode in specific directory
  openportal --port 8080                   Use custom web UI port
  openportal --docker                      Run OpenCode in Docker container
  openportal run --docker                  Run only OpenCode server in Docker
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

async function startOpenCodeDockerContainer(
  directory: string,
  opencodePort: number,
  hostname: string,
  name: string,
): Promise<string> {
  console.log(`Starting OpenCode in Docker container...`);
  console.log(`  Image: ${OPENCODE_DOCKER_IMAGE}`);
  console.log(`  Mount: ${directory} -> ${directory}`);

  const pathValidation = validateMountPath(directory);
  if (!pathValidation.valid) {
    throw new Error(pathValidation.reason);
  }

  const imageResult = await ensureImageExists(OPENCODE_DOCKER_IMAGE, (status) =>
    console.log(`  ${status}`),
  );
  if (!imageResult.success) {
    throw (
      imageResult.error || new Error("Failed to ensure Docker image exists")
    );
  }

  const docker = getDockerClient();
  const containerName = `openportal-${name}-${generateId()}`;

  const container = await docker.createContainer({
    Image: OPENCODE_DOCKER_IMAGE,
    name: containerName,
    Cmd: ["serve", "--port", String(opencodePort), "--hostname", "0.0.0.0"],
    ExposedPorts: {
      [`${opencodePort}/tcp`]: {},
    },
    HostConfig: {
      Binds: [`${directory}:${directory}:rw`],
      PortBindings: {
        [`${opencodePort}/tcp`]: [
          { HostIp: hostname, HostPort: String(opencodePort) },
        ],
      },
      AutoRemove: true,
    },
    WorkingDir: directory,
    Tty: false,
    AttachStdin: false,
    AttachStdout: false,
    AttachStderr: false,
  });

  await container.start();

  const info = await container.inspect();
  console.log(`  Container ID: ${info.Id.substring(0, 12)}`);
  console.log(`  Container Name: ${containerName}`);

  return info.Id;
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

function logInstanceInfo(
  instanceType: InstanceType,
  containerId: string | null,
  opencodePid: number | null,
) {
  if (instanceType === "docker") {
    if (containerId) {
      console.log(`   Container ID: ${containerId.substring(0, 12)}`);
    }
  } else {
    if (opencodePid !== null) {
      console.log(`   OpenCode PID: ${opencodePid}`);
    }
  }
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
  const useDocker = options.docker === true;

  const config = readConfig();

  const existingIndex = config.instances.findIndex(
    (i) => i.directory === directory,
  );
  if (existingIndex !== -1) {
    const existing = config.instances[existingIndex];
    const running = await isInstanceRunning(existing);
    if (running || isProcessRunning(existing.webPid)) {
      console.log(`OpenPortal is already running for this directory.`);
      console.log(`  Name: ${existing.name}`);
      console.log(`  Type: ${existing.instanceType}`);
      console.log(`  Web UI Port: ${existing.port ?? "N/A"}`);
      console.log(`  OpenCode Port: ${existing.opencodePort}`);
      if (existing.instanceType === "docker" && existing.containerId) {
        console.log(`  Container ID: ${existing.containerId.substring(0, 12)}`);
      }
      if (existing.port) {
        console.log(
          `\n📱 Access OpenPortal at http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${existing.port}`,
        );
      }
      console.log(
        `🔧 OpenCode API at http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${existing.opencodePort}`,
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
  console.log(`  Mode: ${useDocker ? "Docker" : "Process"}`);

  try {
    let opencodePid: number | null = null;
    let containerId: string | null = null;

    if (useDocker) {
      containerId = await startOpenCodeDockerContainer(
        directory,
        opencodePort,
        hostname,
        name,
      );
    } else {
      opencodePid = await startOpenCodeServer(
        directory,
        opencodePort,
        hostname,
      );
    }

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
      instanceType: useDocker ? "docker" : "process",
      containerId,
    };

    config.instances.push(instance);
    writeConfig(config);

    const displayHost = hostname === "0.0.0.0" ? "localhost" : hostname;

    console.log(`\n✅ OpenPortal started!`);
    logInstanceInfo(instance.instanceType, containerId, opencodePid);
    console.log(`   Web UI PID: ${webPid}`);
    console.log(`\n📱 Access OpenPortal at http://${displayHost}:${port}`);
    console.log(`🔧 OpenCode API at http://${displayHost}:${opencodePort}`);
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
  const useDocker = options.docker === true;

  const config = readConfig();

  const existingIndex = config.instances.findIndex(
    (i) => i.directory === directory,
  );
  if (existingIndex !== -1) {
    const existing = config.instances[existingIndex];
    const running = await isInstanceRunning(existing);
    if (running) {
      console.log(`OpenCode is already running for this directory.`);
      console.log(`  Name: ${existing.name}`);
      console.log(`  Type: ${existing.instanceType}`);
      console.log(`  OpenCode Port: ${existing.opencodePort}`);
      if (existing.instanceType === "docker" && existing.containerId) {
        console.log(`  Container ID: ${existing.containerId.substring(0, 12)}`);
      }
      console.log(
        `🔧 OpenCode API at http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${existing.opencodePort}`,
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
  console.log(`  Mode: ${useDocker ? "Docker" : "Process"}`);

  try {
    let opencodePid: number | null = null;
    let containerId: string | null = null;

    if (useDocker) {
      containerId = await startOpenCodeDockerContainer(
        directory,
        opencodePort,
        hostname,
        name,
      );
    } else {
      opencodePid = await startOpenCodeServer(
        directory,
        opencodePort,
        hostname,
      );
    }

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
      instanceType: useDocker ? "docker" : "process",
      containerId,
    };

    config.instances.push(instance);
    writeConfig(config);

    const displayHost = hostname === "0.0.0.0" ? "localhost" : hostname;

    console.log(`\n✅ OpenCode server started!`);
    logInstanceInfo(instance.instanceType, containerId, opencodePid);
    console.log(`🔧 OpenCode API at http://${displayHost}:${opencodePort}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Failed to start OpenCode: ${error.message}`);
    }
    process.exit(1);
  }
}

async function cmdStop(options: Record<string, string | boolean | undefined>) {
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

  if (instance.instanceType === "docker" && instance.containerId) {
    const result = await stopAndRemoveContainer(instance.containerId);
    if (result.success) {
      console.log(
        `Stopped and removed Docker container (ID: ${instance.containerId.substring(0, 12)})`,
      );
    } else {
      console.log("Docker container was already stopped or removed.");
    }
  } else if (instance.opencodePid !== null) {
    try {
      process.kill(instance.opencodePid, "SIGTERM");
      console.log(`Stopped OpenCode (PID: ${instance.opencodePid})`);
    } catch {
      console.log("OpenCode was already stopped.");
    }
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

async function cmdList() {
  const config = readConfig();

  if (config.instances.length === 0) {
    console.log("No OpenPortal instances running.");
    return;
  }

  console.log("\nOpenPortal Instances:\n");
  console.log("ID\t\tNAME\t\t\tTYPE\t\tPORT\tOPENCODE\tSTATUS\t\tDIRECTORY");
  console.log("-".repeat(120));

  const validInstances: PortalInstance[] = [];

  for (const instance of config.instances) {
    let opencodeRunning = false;
    if (instance.instanceType === "docker") {
      opencodeRunning = await isContainerRunning(instance.containerId);
    } else {
      opencodeRunning = isProcessRunning(instance.opencodePid);
    }
    const webRunning = isProcessRunning(instance.webPid);

    let status = "stopped";
    if (opencodeRunning && webRunning) status = "running";
    else if (opencodeRunning) status = "opencode";
    else if (webRunning) status = "web only";

    if (opencodeRunning || webRunning) {
      validInstances.push(instance);
    }

    const portDisplay = instance.port ?? "-";
    const typeDisplay =
      instance.instanceType === "docker" ? "docker" : "process";
    console.log(
      `${instance.id}\t${instance.name.padEnd(16)}\t${typeDisplay.padEnd(8)}\t${String(portDisplay).padEnd(4)}\t${instance.opencodePort}\t\t${status.padEnd(12)}\t${instance.directory}`,
    );
  }

  if (validInstances.length !== config.instances.length) {
    config.instances = validInstances;
    writeConfig(config);
  }
}

async function cmdClean() {
  const config = readConfig();
  const validInstances: PortalInstance[] = [];

  for (const instance of config.instances) {
    const running = await isInstanceRunning(instance);
    if (running || isProcessRunning(instance.webPid)) {
      validInstances.push(instance);
    } else {
      if (instance.instanceType === "docker" && instance.containerId) {
        const result = await stopAndRemoveContainer(instance.containerId);
        if (!result.success && result.error) {
          console.warn(
            `  Warning: Could not clean up container ${instance.containerId.substring(0, 12)}`,
          );
        }
      }
      console.log(
        `Removed stale entry: ${instance.name} (${instance.instanceType})`,
      );
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
      await cmdStop(flags);
      break;
    case "list":
    case "ls":
      await cmdList();
      break;
    case "clean":
      await cmdClean();
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
