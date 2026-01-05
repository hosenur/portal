import { defineHandler } from "nitro/h3";
import { homedir } from "os";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

const CONFIG_PATH = join(homedir(), ".portal.json");

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

function readConfig(): PortalConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const content = readFileSync(CONFIG_PATH, "utf-8");
      return JSON.parse(content);
    }
  } catch {}
  return { instances: [] };
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export default defineHandler(async () => {
  const config = readConfig();

  const instances = config.instances
    .filter((instance) => isProcessRunning(instance.pid))
    .map((instance) => ({
      id: instance.id,
      name: instance.name,
      directory: instance.directory,
      port: instance.port,
      hostname: instance.hostname,
      pid: instance.pid,
      startedAt: instance.startedAt,
      state: "running" as const,
      status: `Running since ${new Date(instance.startedAt).toLocaleString()}`,
    }));

  return {
    total: instances.length,
    instances,
  };
});
