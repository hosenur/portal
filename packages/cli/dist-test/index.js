#!/usr/bin/env bun
// @bun

// src/index.ts
import { existsSync, readFileSync, writeFileSync } from "fs";

// ../../node_modules/.bun/get-port-please@3.2.0/node_modules/get-port-please/dist/index.mjs
import { createServer, Server } from "net";
import { networkInterfaces, tmpdir } from "os";
var unsafePorts = /* @__PURE__ */ new Set([
  1,
  7,
  9,
  11,
  13,
  15,
  17,
  19,
  20,
  21,
  22,
  23,
  25,
  37,
  42,
  43,
  53,
  69,
  77,
  79,
  87,
  95,
  101,
  102,
  103,
  104,
  109,
  110,
  111,
  113,
  115,
  117,
  119,
  123,
  135,
  137,
  139,
  143,
  161,
  179,
  389,
  427,
  465,
  512,
  513,
  514,
  515,
  526,
  530,
  531,
  532,
  540,
  548,
  554,
  556,
  563,
  587,
  601,
  636,
  989,
  990,
  993,
  995,
  1719,
  1720,
  1723,
  2049,
  3659,
  4045,
  5060,
  5061,
  6000,
  6566,
  6665,
  6666,
  6667,
  6668,
  6669,
  6697,
  10080
]);
function isUnsafePort(port) {
  return unsafePorts.has(port);
}
function isSafePort(port) {
  return !isUnsafePort(port);
}

class GetPortError extends Error {
  constructor(message, opts) {
    super(message, opts);
    this.message = message;
  }
  name = "GetPortError";
}
function _log(verbose, message) {
  if (verbose) {
    console.log(`[get-port] ${message}`);
  }
}
function _generateRange(from, to) {
  if (to < from) {
    return [];
  }
  const r = [];
  for (let index = from;index <= to; index++) {
    r.push(index);
  }
  return r;
}
function _tryPort(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.on("error", () => {
      resolve(false);
    });
    server.listen({ port, host }, () => {
      const { port: port2 } = server.address();
      server.close(() => {
        resolve(isSafePort(port2) && port2);
      });
    });
  });
}
function _getLocalHosts(additional) {
  const hosts = new Set(additional);
  for (const _interface of Object.values(networkInterfaces())) {
    for (const config of _interface || []) {
      if (config.address && !config.internal && !config.address.startsWith("fe80::") && !config.address.startsWith("169.254")) {
        hosts.add(config.address);
      }
    }
  }
  return [...hosts];
}
async function _findPort(ports, host) {
  for (const port of ports) {
    const r = await _tryPort(port, host);
    if (r) {
      return r;
    }
  }
}
function _fmtOnHost(hostname) {
  return hostname ? `on host ${JSON.stringify(hostname)}` : "on any host";
}
var HOSTNAME_RE = /^(?!-)[\d.:A-Za-z-]{1,63}(?<!-)$/;
function _validateHostname(hostname, _public, verbose) {
  if (hostname && !HOSTNAME_RE.test(hostname)) {
    const fallbackHost = _public ? "0.0.0.0" : "127.0.0.1";
    _log(verbose, `Invalid hostname: ${JSON.stringify(hostname)}. Using ${JSON.stringify(fallbackHost)} as fallback.`);
    return fallbackHost;
  }
  return hostname;
}
async function getPort(_userOptions = {}) {
  if (typeof _userOptions === "number" || typeof _userOptions === "string") {
    _userOptions = { port: Number.parseInt(_userOptions + "") || 0 };
  }
  const _port = Number(_userOptions.port ?? process.env.PORT);
  const _userSpecifiedAnyPort = Boolean(_userOptions.port || _userOptions.ports?.length || _userOptions.portRange?.length);
  const options = {
    random: _port === 0,
    ports: [],
    portRange: [],
    alternativePortRange: _userSpecifiedAnyPort ? [] : [3000, 3100],
    verbose: false,
    ..._userOptions,
    port: _port,
    host: _validateHostname(_userOptions.host ?? process.env.HOST, _userOptions.public, _userOptions.verbose)
  };
  if (options.random && !_userSpecifiedAnyPort) {
    return getRandomPort(options.host);
  }
  const portsToCheck = [
    options.port,
    ...options.ports,
    ..._generateRange(...options.portRange)
  ].filter((port) => {
    if (!port) {
      return false;
    }
    if (!isSafePort(port)) {
      _log(options.verbose, `Ignoring unsafe port: ${port}`);
      return false;
    }
    return true;
  });
  if (portsToCheck.length === 0) {
    portsToCheck.push(3000);
  }
  let availablePort = await _findPort(portsToCheck, options.host);
  if (!availablePort && options.alternativePortRange.length > 0) {
    availablePort = await _findPort(_generateRange(...options.alternativePortRange), options.host);
    if (portsToCheck.length > 0) {
      let message = `Unable to find an available port (tried ${portsToCheck.join("-")} ${_fmtOnHost(options.host)}).`;
      if (availablePort) {
        message += ` Using alternative port ${availablePort}.`;
      }
      _log(options.verbose, message);
    }
  }
  if (!availablePort && _userOptions.random !== false) {
    availablePort = await getRandomPort(options.host);
    if (availablePort) {
      _log(options.verbose, `Using random port ${availablePort}`);
    }
  }
  if (!availablePort) {
    const triedRanges = [
      options.port,
      options.portRange.join("-"),
      options.alternativePortRange.join("-")
    ].filter(Boolean).join(", ");
    throw new GetPortError(`Unable to find an available port ${_fmtOnHost(options.host)} (tried ${triedRanges})`);
  }
  return availablePort;
}
async function getRandomPort(host) {
  const port = await checkPort(0, host);
  if (port === false) {
    throw new GetPortError(`Unable to find a random port ${_fmtOnHost(host)}`);
  }
  return port;
}
async function checkPort(port, host = process.env.HOST, verbose) {
  if (!host) {
    host = _getLocalHosts([undefined, "0.0.0.0"]);
  }
  if (!Array.isArray(host)) {
    return _tryPort(port, host);
  }
  for (const _host of host) {
    const _port = await _tryPort(port, _host);
    if (_port === false) {
      if (port < 1024 && verbose) {
        _log(verbose, `Unable to listen to the privileged port ${port} ${_fmtOnHost(_host)}`);
      }
      return false;
    }
    if (port === 0 && _port !== 0) {
      port = _port;
    }
  }
  return port;
}

// src/index.ts
import { homedir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
var __filename2 = fileURLToPath(import.meta.url);
var __dirname2 = dirname(__filename2);
var CONFIG_PATH = join(homedir(), ".portal.json");
var DEFAULT_HOSTNAME = "0.0.0.0";
var DEFAULT_PORT = 3000;
var DEFAULT_OPENCODE_PORT = 4000;
var WEB_SERVER_PATH = join(__dirname2, "..", "web", "server", "index.mjs");
function readConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      config.instances = config.instances.map((instance) => ({
        ...instance,
        opencodePid: instance.opencodePid ?? null,
        webPid: instance.webPid ?? null
      }));
      return config;
    }
  } catch (error) {
    console.warn(`[config] Failed to read config file, using empty config:`, error instanceof Error ? error.message : error);
  }
  return { instances: [] };
}
function writeConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}
function isProcessRunning(pid) {
  if (pid === null)
    return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function isInstanceRunning(instance) {
  return isProcessRunning(instance.opencodePid) || isProcessRunning(instance.webPid);
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
function parseArgs() {
  const args = [];
  const flags = {};
  for (let i = 2;i < process.argv.length; i++) {
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
async function startOpenCodeServer(directory, opencodePort, hostname) {
  console.log(`Starting OpenCode server...`);
  const proc = Bun.spawn([
    "opencode",
    "serve",
    "--port",
    String(opencodePort),
    "--hostname",
    hostname
  ], {
    cwd: directory,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env }
  });
  return proc.pid;
}
async function startWebServer(port, hostname) {
  console.log(`Starting Web UI server...`);
  const proc = Bun.spawn(["bun", "run", WEB_SERVER_PATH], {
    cwd: dirname(WEB_SERVER_PATH),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      HOST: hostname,
      NITRO_PORT: String(port),
      NITRO_HOST: hostname
    }
  });
  return proc.pid;
}
async function cmdDefault(options) {
  const hostname = options.hostname || DEFAULT_HOSTNAME;
  const directory = resolve(options.directory || options.d || process.cwd());
  const name = options.name || directory.split("/").pop() || "opencode";
  const port = options.port || options.p ? parseInt(options.port || options.p, 10) : await getPort({ host: hostname, port: DEFAULT_PORT });
  const opencodePort = options["opencode-port"] ? parseInt(options["opencode-port"], 10) : await getPort({ host: hostname, port: DEFAULT_OPENCODE_PORT });
  const config = readConfig();
  const existingIndex = config.instances.findIndex((i) => i.directory === directory);
  if (existingIndex !== -1) {
    const existing = config.instances[existingIndex];
    const running = isInstanceRunning(existing);
    if (running || isProcessRunning(existing.webPid)) {
      console.log(`OpenPortal is already running for this directory.`);
      console.log(`  Name: ${existing.name}`);
      console.log(`  Web UI Port: ${existing.port ?? "N/A"}`);
      console.log(`  OpenCode Port: ${existing.opencodePort}`);
      if (existing.port) {
        console.log(`
\uD83D\uDCF1 Access OpenPortal at http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${existing.port}`);
      }
      console.log(`\uD83D\uDD27 OpenCode API at http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${existing.opencodePort}`);
      return;
    }
    config.instances.splice(existingIndex, 1);
  }
  if (!existsSync(WEB_SERVER_PATH)) {
    console.error(`\u274C Web server not found at ${WEB_SERVER_PATH}`);
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
    const opencodePid = await startOpenCodeServer(directory, opencodePort, hostname);
    const webPid = await startWebServer(port, hostname);
    const instance = {
      id: generateId(),
      name,
      directory,
      port,
      opencodePort,
      hostname,
      opencodePid,
      webPid,
      startedAt: new Date().toISOString()
    };
    config.instances.push(instance);
    writeConfig(config);
    const displayHost = hostname === "0.0.0.0" ? "localhost" : hostname;
    console.log(`
\u2705 OpenPortal started!`);
    console.log(`   OpenCode PID: ${opencodePid}`);
    console.log(`   Web UI PID: ${webPid}`);
    console.log(`
\uD83D\uDCF1 Access OpenPortal at http://${displayHost}:${port}`);
    console.log(`\uD83D\uDD27 OpenCode API at http://${displayHost}:${opencodePort}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`
\u274C Failed to start OpenPortal: ${error.message}`);
    }
    process.exit(1);
  }
}
async function cmdRun(options) {
  const hostname = options.hostname || DEFAULT_HOSTNAME;
  const directory = resolve(options.directory || options.d || process.cwd());
  const name = options.name || directory.split("/").pop() || "opencode";
  const opencodePort = options["opencode-port"] ? parseInt(options["opencode-port"], 10) : await getPort({ host: hostname, port: DEFAULT_OPENCODE_PORT });
  const config = readConfig();
  const existingIndex = config.instances.findIndex((i) => i.directory === directory);
  if (existingIndex !== -1) {
    const existing = config.instances[existingIndex];
    const running = isInstanceRunning(existing);
    if (running) {
      console.log(`OpenCode is already running for this directory.`);
      console.log(`  Name: ${existing.name}`);
      console.log(`  OpenCode Port: ${existing.opencodePort}`);
      console.log(`\uD83D\uDD27 OpenCode API at http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${existing.opencodePort}`);
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
    const opencodePid = await startOpenCodeServer(directory, opencodePort, hostname);
    const instance = {
      id: generateId(),
      name,
      directory,
      port: null,
      opencodePort,
      hostname,
      opencodePid,
      webPid: null,
      startedAt: new Date().toISOString()
    };
    config.instances.push(instance);
    writeConfig(config);
    const displayHost = hostname === "0.0.0.0" ? "localhost" : hostname;
    console.log(`
\u2705 OpenCode server started!`);
    console.log(`   OpenCode PID: ${opencodePid}`);
    console.log(`\uD83D\uDD27 OpenCode API at http://${displayHost}:${opencodePort}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`
\u274C Failed to start OpenCode: ${error.message}`);
    }
    process.exit(1);
  }
}
async function cmdStop(options) {
  const config = readConfig();
  const directory = options.directory || options.d ? resolve(options.directory || options.d) : process.cwd();
  const instance = options.name ? config.instances.find((i) => i.name === options.name) : config.instances.find((i) => i.directory === directory);
  if (!instance) {
    console.error("No instance found.");
    process.exit(1);
  }
  if (instance.opencodePid !== null) {
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
  console.log(`
Stopped: ${instance.name}`);
}
async function cmdList() {
  const config = readConfig();
  if (config.instances.length === 0) {
    console.log("No OpenPortal instances running.");
    return;
  }
  console.log(`
OpenPortal Instances:
`);
  console.log("ID\t\tNAME\t\t\tPORT\tOPENCODE\tSTATUS\t\tDIRECTORY");
  console.log("-".repeat(110));
  const validInstances = [];
  for (const instance of config.instances) {
    const opencodeRunning = isProcessRunning(instance.opencodePid);
    const webRunning = isProcessRunning(instance.webPid);
    let status = "stopped";
    if (opencodeRunning && webRunning)
      status = "running";
    else if (opencodeRunning)
      status = "opencode";
    else if (webRunning)
      status = "web only";
    if (opencodeRunning || webRunning) {
      validInstances.push(instance);
    }
    const portDisplay = instance.port ?? "-";
    console.log(`${instance.id}	${instance.name.padEnd(16)}	${String(portDisplay).padEnd(4)}	${instance.opencodePort}		${status.padEnd(12)}	${instance.directory}`);
  }
  if (validInstances.length !== config.instances.length) {
    config.instances = validInstances;
    writeConfig(config);
  }
}
async function cmdClean() {
  const config = readConfig();
  const validInstances = [];
  for (const instance of config.instances) {
    const running = isInstanceRunning(instance);
    if (running || isProcessRunning(instance.webPid)) {
      validInstances.push(instance);
    } else {
      console.log(`Removed stale entry: ${instance.name}`);
    }
  }
  config.instances = validInstances;
  writeConfig(config);
  console.log(`
Config cleaned. ${validInstances.length} active instance(s).`);
}
async function main() {
  const { args, flags } = parseArgs();
  if (flags.help || flags.h) {
    printHelp();
    return;
  }
  const command = args[0]?.toLowerCase();
  if (!command || command === "." || command.startsWith("/") || command.startsWith("./")) {
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
