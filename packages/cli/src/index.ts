#!/usr/bin/env bun

import { $ } from "bun";
import { Command } from "commander";
import { getPort } from "get-port-please";
import { homedir } from "os";
import { join } from "path";

const CONFIG_PATH = join(homedir(), ".portal.json");
const DEFAULT_PORT_RANGE: [number, number] = [3500, 4200];
const DEFAULT_HOSTNAME = "0.0.0.0";

interface PortalInstance {
  id: string;
  name: string;
  directory: string;
  port: number;
  hostname: string;
  pid: number;
  startedAt: string;
}

interface PortalConfig {
  instances: PortalInstance[];
}

async function readConfig(): Promise<PortalConfig> {
  try {
    const file = Bun.file(CONFIG_PATH);
    if (await file.exists()) {
      return await file.json();
    }
  } catch {}
  return { instances: [] };
}

async function writeConfig(config: PortalConfig): Promise<void> {
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const program = new Command()
  .name("portal")
  .description("CLI to run OpenCode instances")
  .version("0.1.0");

program
  .command("run")
  .description("Start an OpenCode instance for the current directory")
  .option("-d, --directory <path>", "Directory to serve", process.cwd())
  .option("--name <name>", "Instance name")
  .option("-p, --port <port>", "Port to use (auto-selects if not specified)")
  .option("--hostname <hostname>", "Hostname to bind to", DEFAULT_HOSTNAME)
  .option(
    "--port-range-start <start>",
    "Start of port range",
    String(DEFAULT_PORT_RANGE[0]),
  )
  .option(
    "--port-range-end <end>",
    "End of port range",
    String(DEFAULT_PORT_RANGE[1]),
  )
  .action(async (options) => {
    const { hostname } = options;
    const resolvedDir = Bun.fileURLToPath(
      new URL(options.directory, `file://${process.cwd()}/`),
    );
    const dirName = resolvedDir.split("/").pop() || "opencode";
    const name = options.name || dirName;

    const portRangeStart = parseInt(options.portRangeStart, 10);
    const portRangeEnd = parseInt(options.portRangeEnd, 10);

    const port = options.port
      ? parseInt(options.port, 10)
      : await getPort({
          host: hostname,
          portRange: [portRangeStart, portRangeEnd],
        });

    const config = await readConfig();

    const existingIndex = config.instances.findIndex(
      (i) => i.directory === resolvedDir,
    );
    if (existingIndex !== -1) {
      const existing = config.instances[existingIndex];
      if (await isProcessRunning(existing.pid)) {
        console.log(`OpenCode is already running for this directory.`);
        console.log(`  Name: ${existing.name}`);
        console.log(`  Port: ${existing.port}`);
        console.log(`  PID: ${existing.pid}`);
        console.log(`\nAccess OpenCode at http://localhost:${existing.port}`);
        return;
      }
      config.instances.splice(existingIndex, 1);
    }

    console.log(`Starting OpenCode...`);
    console.log(`  Name: ${name}`);
    console.log(`  Directory: ${resolvedDir}`);
    console.log(`  Port: ${port}`);
    console.log(`  Hostname: ${hostname}`);

    try {
      const proc = Bun.spawn(
        ["opencode", "serve", "--port", String(port), "--hostname", hostname],
        {
          cwd: resolvedDir,
          stdio: ["ignore", "ignore", "ignore"],
          env: { ...process.env },
        },
      );

      const instance: PortalInstance = {
        id: generateId(),
        name,
        directory: resolvedDir,
        port,
        hostname,
        pid: proc.pid,
        startedAt: new Date().toISOString(),
      };

      config.instances.push(instance);
      await writeConfig(config);

      console.log(`\nOpenCode started. (PID: ${proc.pid})`);
      console.log(`Access OpenCode at http://localhost:${port}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to start OpenCode: ${error.message}`);
      }
      process.exit(1);
    }
  });

program
  .command("stop")
  .description("Stop a running OpenCode instance")
  .option("--name <name>", "Instance name")
  .option("-d, --directory <path>", "Directory of the instance")
  .option("--all", "Stop all instances")
  .action(async (options) => {
    const config = await readConfig();

    if (options.all) {
      for (const instance of config.instances) {
        try {
          process.kill(instance.pid, "SIGTERM");
          console.log(`Stopped: ${instance.name} (PID: ${instance.pid})`);
        } catch {
          console.log(`Already stopped: ${instance.name}`);
        }
      }
      config.instances = [];
      await writeConfig(config);
      console.log(`\nAll instances stopped.`);
      return;
    }

    const directory = options.directory
      ? Bun.fileURLToPath(
          new URL(options.directory, `file://${process.cwd()}/`),
        )
      : process.cwd();

    const instance = options.name
      ? config.instances.find((i) => i.name === options.name)
      : config.instances.find((i) => i.directory === directory);

    if (!instance) {
      console.error(`No instance found.`);
      process.exit(1);
    }

    try {
      process.kill(instance.pid, "SIGTERM");
      console.log(`Stopped: ${instance.name} (PID: ${instance.pid})`);
    } catch {
      console.log(`Instance was already stopped.`);
    }

    config.instances = config.instances.filter((i) => i.id !== instance.id);
    await writeConfig(config);
  });

program
  .command("list")
  .alias("ls")
  .description("List running OpenCode instances")
  .action(async () => {
    const config = await readConfig();

    if (config.instances.length === 0) {
      console.log("No OpenCode instances running.");
      return;
    }

    const validInstances: PortalInstance[] = [];

    console.log("\nOpenCode Instances:\n");
    console.log("ID\t\tNAME\t\t\tPORT\tSTATUS\t\tDIRECTORY");
    console.log("-".repeat(80));

    for (const instance of config.instances) {
      const running = await isProcessRunning(instance.pid);
      const status = running ? "running" : "stopped";

      if (running) {
        validInstances.push(instance);
      }

      console.log(
        `${instance.id}\t${instance.name.padEnd(16)}\t${instance.port}\t${status.padEnd(12)}\t${instance.directory}`,
      );
    }

    if (validInstances.length !== config.instances.length) {
      config.instances = validInstances;
      await writeConfig(config);
    }
  });

program
  .command("clean")
  .description("Clean up stale entries from config")
  .action(async () => {
    const config = await readConfig();
    const validInstances: PortalInstance[] = [];

    for (const instance of config.instances) {
      if (await isProcessRunning(instance.pid)) {
        validInstances.push(instance);
      } else {
        console.log(`Removed stale entry: ${instance.name}`);
      }
    }

    config.instances = validInstances;
    await writeConfig(config);
    console.log(
      `\nConfig cleaned. ${validInstances.length} active instance(s).`,
    );
  });

program.parse();
