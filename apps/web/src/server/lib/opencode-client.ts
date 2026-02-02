import { createOpencodeClient } from "@opencode-ai/sdk";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_PATH = join(homedir(), ".portal.json");

// Cache clients by host:port
const clientCache = new Map<string, ReturnType<typeof createOpencodeClient>>();

function getHostnameForPort(port: number): string {
  try {
    if (existsSync(CONFIG_PATH)) {
      const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      const instance = config.instances?.find(
        (i: { opencodePort: number }) => i.opencodePort === port
      );
      if (instance?.hostname && instance.hostname !== "0.0.0.0") {
        return instance.hostname;
      }
    }
  } catch {
    // Fall back to localhost
  }
  return "localhost";
}

export function getOpencodeClient(port: number) {
  const hostname = getHostnameForPort(port);
  const key = `${hostname}:${port}`;

  const cached = clientCache.get(key);
  if (cached) {
    return cached;
  }

  const client = createOpencodeClient({
    baseUrl: `http://${hostname}:${port}`,
  });

  clientCache.set(key, client);
  return client;
}

export function clearClientCache(port?: number) {
  if (port) {
    const hostname = getHostnameForPort(port);
    clientCache.delete(`${hostname}:${port}`);
  } else {
    clientCache.clear();
  }
}
