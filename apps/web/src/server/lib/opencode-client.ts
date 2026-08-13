import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_PATH = join(homedir(), ".portal.json");

const clientCache = new Map<string, ReturnType<typeof createOpencodeClient>>();

function getHostnameForPort(port: number): string {
  try {
    if (existsSync(CONFIG_PATH)) {
      const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      const instance = config.instances?.find(
        (i: {
          opencodePort: number;
          backendPort?: number;
          provider?: string;
        }) =>
          (i.provider ?? "opencode") === "opencode" &&
          (i.backendPort ?? i.opencodePort) === port,
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

export function getOpencodeBaseUrl(port: number) {
  const hostname = getHostnameForPort(port);
  return `http://${hostname}:${port}`;
}

function getAuthHeaders(): Record<string, string> | undefined {
  const username = process.env.OPENCODE_SERVER_USERNAME;
  const password = process.env.OPENCODE_SERVER_PASSWORD;
  if (username && password) {
    return {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    };
  }
}

export function getOpencodeClient(port: number) {
  const baseUrl = getOpencodeBaseUrl(port);

  const cached = clientCache.get(baseUrl);
  if (cached) {
    return cached;
  }

  const authHeaders = getAuthHeaders();
  const client = createOpencodeClient({
    baseUrl,
    ...(authHeaders ? { headers: authHeaders } : {}),
  });

  clientCache.set(baseUrl, client);
  return client;
}

export function clearClientCache(port?: number) {
  if (port) {
    clientCache.delete(getOpencodeBaseUrl(port));
  } else {
    clientCache.clear();
  }
}
