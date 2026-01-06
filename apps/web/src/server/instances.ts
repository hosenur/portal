import { defineHandler } from "nitro/h3";
import { homedir } from "os";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { isContainerRunning } from "./lib/docker";

const CONFIG_PATH = join(homedir(), ".portal.json");

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
      const content = readFileSync(CONFIG_PATH, "utf-8");
      const config = JSON.parse(content);
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
      `[config] Failed to read config file:`,
      error instanceof Error ? error.message : error,
    );
  }
  return { instances: [] };
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

export default defineHandler(async () => {
  const config = readConfig();

  const instancePromises = config.instances.map(async (instance) => {
    let opencodeRunning = false;
    if (instance.instanceType === "docker") {
      opencodeRunning = await isContainerRunning(instance.containerId);
    } else {
      opencodeRunning = isProcessRunning(instance.opencodePid);
    }
    const webRunning = isProcessRunning(instance.webPid);

    if (!opencodeRunning && !webRunning) {
      return null;
    }

    return {
      id: instance.id,
      name: instance.name,
      directory: instance.directory,
      port: instance.opencodePort,
      hostname: instance.hostname,
      opencodePid: instance.opencodePid,
      webPid: instance.webPid,
      startedAt: instance.startedAt,
      instanceType: instance.instanceType,
      containerId: instance.containerId,
      state: "running" as const,
      status: `Running since ${new Date(instance.startedAt).toLocaleString()}`,
    };
  });

  const results = await Promise.all(instancePromises);
  const instances = results.filter((instance) => instance !== null);

  return {
    total: instances.length,
    instances,
  };
});
