#!/usr/bin/env bun

import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "fs";
import { getPort } from "get-port-please";
import { homedir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(homedir(), ".portal.json");
const CONFIG_LOCK_PATH = `${CONFIG_PATH}.lock`;
const DEFAULT_HOSTNAME = "0.0.0.0";
const DEFAULT_CODEX_HOSTNAME = "127.0.0.1";
const DEFAULT_PORT = 3000;
const DEFAULT_OPENCODE_PORT = 4000;
const DEFAULT_CODEX_PORT = 4500;
const DEFAULT_CLAUDE_PORT = 4600;

const WEB_SERVER_PATH = join(__dirname, "..", "web", "server", "index.mjs");

type Provider = "opencode" | "codex" | "claude";

interface PortalInstance {
  id: string;
  name: string;
  directory: string;
  port: number | null;
  provider?: Provider;
  backendPort?: number;
  backendPid?: number | null;
  opencodePort: number;
  hostname: string;
  opencodePid: number | null;
  webPid: number | null;
  startedAt: string;
  claudeBinaryPath?: string;
  claudeHomePath?: string;
  claudeLaunchArgs?: string;
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
        provider: instance.provider ?? "opencode",
        backendPort: instance.backendPort ?? instance.opencodePort,
        backendPid: instance.backendPid ?? instance.opencodePid ?? null,
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

// Acquire an exclusive advisory lock on ~/.portal.json by atomically creating
// ~/.portal.json.lock with O_CREAT|O_EXCL ('wx' in Node). Stores the holder's
// pid so a subsequent caller can detect and steal a stale lock left behind by
// a process that crashed before releasing it.
function acquireConfigLock(timeoutMs = 30_000): () => void {
  const start = Date.now();
  // 50ms initial backoff, capped at 250ms.
  let backoff = 50;
  while (true) {
    try {
      const fd = openSync(CONFIG_LOCK_PATH, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      return () => {
        try {
          unlinkSync(CONFIG_LOCK_PATH);
        } catch {
          // Already removed (e.g. by a stale-lock stealer); not our problem.
        }
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (tryStealStaleLock()) continue;
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `Could not acquire ${CONFIG_LOCK_PATH} within ${timeoutMs}ms.`,
        );
      }
      // Synchronous sleep; CLI is single-threaded and we want simple semantics.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, backoff);
      backoff = Math.min(backoff * 2, 250);
    }
  }
}

function tryStealStaleLock(): boolean {
  let holderPid: number;
  try {
    holderPid = parseInt(readFileSync(CONFIG_LOCK_PATH, "utf-8"), 10);
  } catch {
    // Lock file vanished while we were inspecting it; whoever held it released.
    return true;
  }
  if (!Number.isFinite(holderPid) || holderPid <= 0) return false;
  if (isProcessRunning(holderPid)) return false;
  // Holder is dead; remove the corpse so the next loop iteration can lock.
  try {
    unlinkSync(CONFIG_LOCK_PATH);
  } catch {}
  return true;
}

// Atomically read, mutate, and write ~/.portal.json. The mutator runs while
// the file lock is held, so concurrent CLI invocations cannot lose updates.
// Use this for any code path that wants to add, remove, or amend an instance.
function mutateConfig<T>(mutator: (config: PortalConfig) => T): T {
  const release = acquireConfigLock();
  try {
    const config = readConfig();
    const result = mutator(config);
    writeConfig(config);
    return result;
  } finally {
    release();
  }
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

function getInstanceProvider(instance: PortalInstance): Provider {
  return instance.provider ?? "opencode";
}

function getInstanceBackendPort(instance: PortalInstance): number {
  return instance.backendPort ?? instance.opencodePort;
}

function getInstanceBackendPid(instance: PortalInstance): number | null {
  return instance.backendPid ?? instance.opencodePid ?? null;
}

function isInstanceRunning(instance: PortalInstance): boolean {
  if (getInstanceProvider(instance) === "claude") {
    return (
      isProcessRunning(getInstanceBackendPid(instance)) ||
      isProcessRunning(instance.webPid)
    );
  }

  return (
    isProcessRunning(getInstanceBackendPid(instance)) ||
    isProcessRunning(instance.webPid)
  );
}

function providerName(provider: Provider): string {
  if (provider === "codex") return "Codex";
  if (provider === "claude") return "Claude";
  return "OpenCode";
}

function backendName(provider: Provider): string {
  if (provider === "codex") return "Codex app-server";
  if (provider === "claude") return "Claude SDK";
  return "OpenCode API";
}

function backendLocation(provider: Provider, host: string, port: number): string {
  if (provider === "claude") {
    return `Claude SDK managed by Web UI (instance key: ${port})`;
  }
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  return `http://${displayHost}:${port}`;
}

function printHelp() {
  console.log(`
OpenPortal CLI - Run coding agents with a web UI

Usage: openportal [command] [options]

Commands:
  (default)       Start provider backend and Web UI
  run [provider]  Start only a provider backend (opencode, codex, or claude)
  stop            Stop running instances
  list, ls        List running instances
  clean           Clean up stale entries

Options:
  -h, --help              Show this help message
  -d, --directory <path>  Working directory (default: current directory)
  -p, --port <port>       Web UI port (default: 3000)
  --provider <provider>   Backend provider: opencode, codex, or claude (default: opencode)
  --backend-port <port>   Backend server port for the selected provider
  --opencode-port <port>  OpenCode server port (default: 4000)
  --codex-port <port>     Codex app-server port (default: 4500)
  --claude-port <port>    Claude instance key (default: 4600)
  --claude-binary <path>  Claude binary path (default: claude)
  --claude-home <path>    Custom HOME for Claude
  --claude-args <args>    Extra Claude launch args
  --hostname <host>       Hostname to bind (default: 0.0.0.0)
  --name <name>           Instance name

Examples:
  openportal                               Start OpenCode + Web UI
  openportal --provider codex              Start Codex + Web UI
  openportal --provider claude             Start Claude + Web UI
  openportal .                             Start OpenCode + Web UI in current dir
  openportal run                           Start only OpenCode server
  openportal run opencode                  Start only OpenCode server
  openportal run codex                     Start only Codex app-server
  openportal run claude                    Keep Claude SDK backend registered
  openportal run codex -d ./my-project     Start Codex in specific directory
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

function parseProvider(value: unknown): Provider | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (
    normalized === "opencode" ||
    normalized === "codex" ||
    normalized === "claude"
  ) {
    return normalized;
  }
  return null;
}

function getProviderOption(
  options: Record<string, string | boolean | undefined>,
): Provider {
  return parseProvider(options.provider) ?? "opencode";
}

async function getBackendPort(
  provider: Provider,
  options: Record<string, string | boolean | undefined>,
  hostname: string,
): Promise<number> {
  const explicit =
    options["backend-port"] ??
    (provider === "codex"
      ? options["codex-port"]
      : provider === "claude"
        ? options["claude-port"]
        : options["opencode-port"]);

  if (explicit) {
    return parseInt(explicit as string, 10);
  }

  if (provider === "claude") {
    const used = new Set(
      readConfig().instances
        .filter(
          (instance) =>
            getInstanceProvider(instance) === "claude" &&
            isInstanceRunning(instance),
        )
        .map((instance) => getInstanceBackendPort(instance)),
    );
    let port = DEFAULT_CLAUDE_PORT;
    while (used.has(port) && port < 65535) {
      port += 1;
    }
    return port;
  }

  return getPort({
    host: hostname,
    port: provider === "codex" ? DEFAULT_CODEX_PORT : DEFAULT_OPENCODE_PORT,
  });
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

async function startCodexServer(
  directory: string,
  codexPort: number,
): Promise<number> {
  console.log(`Starting Codex app-server...`);
  const proc = Bun.spawn(
    [
      "codex",
      "app-server",
      "--listen",
      `ws://${DEFAULT_CODEX_HOSTNAME}:${codexPort}`,
    ],
    {
      cwd: directory,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    },
  );
  return proc.pid;
}

async function startBackendServer(
  provider: Provider,
  directory: string,
  backendPort: number,
  hostname: string,
): Promise<number | null> {
  if (provider === "codex") {
    return startCodexServer(directory, backendPort);
  }

  if (provider === "claude") {
    console.log(`Claude SDK will be managed by the Web UI.`);
    return null;
  }

  return startOpenCodeServer(directory, backendPort, hostname);
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

async function waitForClaudeRegistration(instance: PortalInstance) {
  console.log("\nClaude SDK registration is active.");
  console.log("Keep this command running while you use this Claude instance.");
  console.log("Press Ctrl-C to stop it.");

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {}, 60 * 60 * 1000);
    let settled = false;

    const stop = () => {
      if (settled) return;
      settled = true;
      clearInterval(interval);
      resolve();
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });

  mutateConfig((config) => {
    config.instances = config.instances.filter((i) => i.id !== instance.id);
  });

  console.log(`\nStopped Claude SDK backend: ${instance.name}`);
}

async function cmdDefault(
  options: Record<string, string | boolean | undefined>,
) {
  const provider = getProviderOption(options);
  const hostname = (options.hostname as string) || DEFAULT_HOSTNAME;
  const directory = resolve(
    (options.directory as string) || (options.d as string) || process.cwd(),
  );
  const name =
    (options.name as string) || directory.split("/").pop() || provider;
  const port =
    options.port || options.p
      ? parseInt((options.port as string) || (options.p as string), 10)
      : await getPort({ host: hostname, port: DEFAULT_PORT });
  const backendHost = provider === "codex" ? DEFAULT_CODEX_HOSTNAME : hostname;
  const backendPort = await getBackendPort(provider, options, backendHost);

  const existing = readConfig().instances.find(
    (i) => i.directory === directory && getInstanceProvider(i) === provider,
  );
  const existingIsActive =
    existing &&
    (provider === "claude"
      ? isProcessRunning(existing.webPid)
      : isInstanceRunning(existing));
  if (existing && existingIsActive) {
    const existingProvider = getInstanceProvider(existing);
    const existingBackendPort = getInstanceBackendPort(existing);
    console.log(`OpenPortal is already running for this directory.`);
    console.log(`  Name: ${existing.name}`);
    console.log(`  Provider: ${existingProvider}`);
    console.log(`  Web UI Port: ${existing.port ?? "N/A"}`);
    console.log(
      `  ${existingProvider === "claude" ? "Instance Key" : "Backend Port"}: ${existingBackendPort}`,
    );
    if (existing.port) {
      console.log(
        `\n📱 Access OpenPortal at http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${existing.port}`,
      );
    }
    console.log(
      `🔧 ${backendName(existingProvider)} at ${backendLocation(existingProvider, backendHost, existingBackendPort)}`,
    );
    return;
  }

  if (!existsSync(WEB_SERVER_PATH)) {
    console.error(`❌ Web server not found at ${WEB_SERVER_PATH}`);
    console.error(`   The web app may not be bundled correctly.`);
    process.exit(1);
  }

  console.log(`Starting OpenPortal...`);
  console.log(`  Name: ${name}`);
  console.log(`  Provider: ${provider}`);
  console.log(`  Directory: ${directory}`);
  console.log(`  Web UI Port: ${port}`);
  console.log(
    `  ${provider === "claude" ? "Instance Key" : "Backend Port"}: ${backendPort}`,
  );
  console.log(`  Hostname: ${hostname}`);

  try {
    const backendPid = await startBackendServer(
      provider,
      directory,
      backendPort,
      hostname,
    );
    const webPid = await startWebServer(port, hostname);

    const instance: PortalInstance = {
      id: generateId(),
      name,
      directory,
      port,
      provider,
      backendPort,
      backendPid,
      opencodePort: backendPort,
      hostname: backendHost,
      opencodePid: provider === "opencode" ? backendPid : null,
      webPid,
      startedAt: new Date().toISOString(),
      ...(provider === "claude"
        ? {
            claudeBinaryPath: options["claude-binary"] as string | undefined,
            claudeHomePath: options["claude-home"] as string | undefined,
            claudeLaunchArgs: (options["claude-launch-args"] ??
              options["claude-args"]) as string | undefined,
          }
        : {}),
    };

    mutateConfig((config) => {
      config.instances = config.instances.filter(
        (i) => i.directory !== directory || getInstanceProvider(i) !== provider,
      );
      config.instances.push(instance);
    });

    const displayHost = hostname === "0.0.0.0" ? "localhost" : hostname;
    console.log(`\n✅ OpenPortal started!`);
    if (backendPid) {
      console.log(`   ${providerName(provider)} PID: ${backendPid}`);
    } else {
      console.log(`   ${backendName(provider)}: managed by Web UI`);
    }
    console.log(`   Web UI PID: ${webPid}`);
    console.log(`\n📱 Access OpenPortal at http://${displayHost}:${port}`);
    console.log(
      `🔧 ${backendName(provider)} at ${backendLocation(provider, backendHost, backendPort)}`,
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Failed to start OpenPortal: ${error.message}`);
    }
    process.exit(1);
  }
}

async function cmdRun(
  options: Record<string, string | boolean | undefined>,
  provider = getProviderOption(options),
) {
  const hostname = (options.hostname as string) || DEFAULT_HOSTNAME;
  const directory = resolve(
    (options.directory as string) || (options.d as string) || process.cwd(),
  );
  const name =
    (options.name as string) || directory.split("/").pop() || provider;
  const backendHost = provider === "codex" ? DEFAULT_CODEX_HOSTNAME : hostname;
  const backendPort = await getBackendPort(provider, options, backendHost);

  const existing = readConfig().instances.find(
    (i) => i.directory === directory && getInstanceProvider(i) === provider,
  );
  if (existing && isInstanceRunning(existing)) {
    const existingBackendPort = getInstanceBackendPort(existing);
    console.log(
      `${providerName(provider)} is already running for this directory.`,
    );
    console.log(`  Name: ${existing.name}`);
    console.log(`  Provider: ${getInstanceProvider(existing)}`);
    console.log(
      `  ${provider === "claude" ? "Instance Key" : "Backend Port"}: ${existingBackendPort}`,
    );
    console.log(
      `🔧 ${backendName(provider)} at ${backendLocation(provider, backendHost, existingBackendPort)}`,
    );
    return;
  }

  console.log(
    provider === "claude"
      ? "Registering Claude SDK backend..."
      : `Starting ${backendName(provider)}...`,
  );
  console.log(`  Name: ${name}`);
  console.log(`  Provider: ${provider}`);
  console.log(`  Directory: ${directory}`);
  console.log(
    `  ${provider === "claude" ? "Instance Key" : "Backend Port"}: ${backendPort}`,
  );
  console.log(`  Hostname: ${backendHost}`);

  try {
    if (provider === "claude") {
      const instance: PortalInstance = {
        id: generateId(),
        name,
        directory,
        port: null,
        provider,
        backendPort,
        backendPid: process.pid,
        opencodePort: backendPort,
        hostname: backendHost,
        opencodePid: null,
        webPid: null,
        startedAt: new Date().toISOString(),
        claudeBinaryPath: options["claude-binary"] as string | undefined,
        claudeHomePath: options["claude-home"] as string | undefined,
        claudeLaunchArgs: (options["claude-launch-args"] ??
          options["claude-args"]) as string | undefined,
      };

      mutateConfig((config) => {
        config.instances = config.instances.filter(
          (i) =>
            i.directory !== directory || getInstanceProvider(i) !== provider,
        );
        config.instances.push(instance);
      });

      console.log("\n✅ Claude SDK backend registered!");
      console.log(`   Claude holder PID: ${process.pid}`);
      console.log(
        `🔧 ${backendName(provider)} at ${backendLocation(provider, backendHost, backendPort)}`,
      );

      await waitForClaudeRegistration(instance);
      return;
    }

    const backendPid = await startBackendServer(
      provider,
      directory,
      backendPort,
      hostname,
    );

    const instance: PortalInstance = {
      id: generateId(),
      name,
      directory,
      port: null,
      provider,
      backendPort,
      backendPid,
      opencodePort: backendPort,
      hostname: backendHost,
      opencodePid: provider === "opencode" ? backendPid : null,
      webPid: null,
      startedAt: new Date().toISOString(),
    };

    mutateConfig((config) => {
      config.instances = config.instances.filter(
        (i) => i.directory !== directory || getInstanceProvider(i) !== provider,
      );
      config.instances.push(instance);
    });

    console.log(`\n✅ ${backendName(provider)} started!`);
    if (backendPid) {
      console.log(`   ${providerName(provider)} PID: ${backendPid}`);
    }
    console.log(
      `🔧 ${backendName(provider)} at ${backendLocation(provider, backendHost, backendPort)}`,
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `\n❌ Failed to start ${providerName(provider)}: ${error.message}`,
      );
    }
    process.exit(1);
  }
}

async function cmdStop(options: Record<string, string | boolean | undefined>) {
  const directory =
    options.directory || options.d
      ? resolve((options.directory as string) || (options.d as string))
      : process.cwd();

  const removed = mutateConfig((config) => {
    const instance = options.name
      ? config.instances.find((i) => i.name === options.name)
      : config.instances.find((i) => i.directory === directory);
    if (!instance) return null;
    config.instances = config.instances.filter((i) => i.id !== instance.id);
    return instance;
  });

  if (!removed) {
    console.error("No instance found.");
    process.exit(1);
  }

  const provider = getInstanceProvider(removed);
  const backendPid = getInstanceBackendPid(removed);

  if (backendPid !== null) {
    try {
      process.kill(backendPid, "SIGTERM");
      console.log(`Stopped ${providerName(provider)} (PID: ${backendPid})`);
    } catch {
      console.log(`${providerName(provider)} was already stopped.`);
    }
  }

  if (removed.webPid !== null) {
    try {
      process.kill(removed.webPid, "SIGTERM");
      console.log(`Stopped Web UI (PID: ${removed.webPid})`);
    } catch {
      console.log("Web UI was already stopped.");
    }
  }

  console.log(`\nStopped: ${removed.name}`);
}

async function cmdList() {
  const config = readConfig();

  if (config.instances.length === 0) {
    console.log("No OpenPortal instances running.");
    return;
  }

  console.log("\nOpenPortal Instances:\n");
  console.log("ID\t\tNAME\t\t\tPROVIDER\tPORT\tBACKEND\tSTATUS\t\tDIRECTORY");
  console.log("-".repeat(110));

  const liveIds = new Set<string>();

  for (const instance of config.instances) {
    const provider = getInstanceProvider(instance);
    const backendRunning = isProcessRunning(getInstanceBackendPid(instance));
    const webRunning = isProcessRunning(instance.webPid);

    let status = "stopped";
    if (provider === "claude") {
      if (webRunning) status = "running";
      else if (backendRunning) status = "registered";
    } else if (backendRunning && webRunning) status = "running";
    else if (backendRunning) status = provider;
    else if (webRunning) status = "web only";

    if (backendRunning || webRunning) {
      liveIds.add(instance.id);
    }

    const portDisplay = instance.port ?? "-";
    console.log(
      `${instance.id}\t${instance.name.padEnd(16)}\t${provider.padEnd(8)}\t${String(portDisplay).padEnd(4)}\t${getInstanceBackendPort(instance)}\t\t${status.padEnd(12)}\t${instance.directory}`,
    );
  }

  if (liveIds.size !== config.instances.length) {
    mutateConfig((latest) => {
      latest.instances = latest.instances.filter(
        (i) => liveIds.has(i.id) || isInstanceRunning(i),
      );
    });
  }
}

async function cmdClean() {
  const result = mutateConfig((config) => {
    const valid: PortalInstance[] = [];
    const removed: string[] = [];
    for (const instance of config.instances) {
      if (isInstanceRunning(instance)) {
        valid.push(instance);
      } else {
        removed.push(instance.name);
      }
    }
    config.instances = valid;
    return { valid, removed };
  });

  for (const name of result.removed) {
    console.log(`Removed stale entry: ${name}`);
  }
  console.log(`\nConfig cleaned. ${result.valid.length} active instance(s).`);
}

async function main() {
  const { args, flags } = parseArgs();

  if (flags.help || flags.h) {
    printHelp();
    return;
  }

  const command = args[0]?.toLowerCase();
  const commandProvider = parseProvider(command);

  if (
    !command ||
    command === "." ||
    command.startsWith("/") ||
    command.startsWith("./") ||
    commandProvider
  ) {
    if (command && command !== ".") {
      if (commandProvider) {
        flags.provider = commandProvider;
      } else {
        flags.directory = command;
      }
    }
    await cmdDefault(flags);
    return;
  }

  switch (command) {
    case "run": {
      const provider = parseProvider(args[1]) ?? getProviderOption(flags);
      if (args[1] && !parseProvider(args[1])) {
        flags.directory = args[1];
      }
      await cmdRun(flags, provider);
      break;
    }
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
