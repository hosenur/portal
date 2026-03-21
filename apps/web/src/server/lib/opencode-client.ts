import { createOpencodeClient } from "@opencode-ai/sdk";
import { createOpencodeClient as createOpencodeClientV2 } from "@opencode-ai/sdk/v2/client";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_PATH = join(homedir(), ".portal.json");

const clientCache = new Map<string, ReturnType<typeof createOpencodeClient>>();
const clientCacheV2 = new Map<string, ReturnType<typeof createOpencodeClientV2>>();

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

export function getOpencodeClientV2(port: number) {
  const hostname = getHostnameForPort(port);
  const key = `${hostname}:${port}`;

  const cached = clientCacheV2.get(key);
  if (cached) {
    return cached;
  }

  const client = createOpencodeClientV2({
    baseUrl: `http://${hostname}:${port}`,
  });

  clientCacheV2.set(key, client);
  return client;
}

export function clearClientCache(port?: number) {
  if (port) {
    const hostname = getHostnameForPort(port);
    const key = `${hostname}:${port}`;
    clientCache.delete(key);
    clientCacheV2.delete(key);
  } else {
    clientCache.clear();
    clientCacheV2.clear();
  }
}
