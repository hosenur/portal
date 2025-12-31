import { createOpencodeClient } from "@opencode-ai/sdk";

// Cache clients per port to avoid recreating them
const clientCache = new Map<number, ReturnType<typeof createOpencodeClient>>();

export function getOpencodeClient(port: number) {
  const cached = clientCache.get(port);
  if (cached) {
    return cached;
  }

  const client = createOpencodeClient({
    baseUrl: `http://localhost:${port}`,
  });

  clientCache.set(port, client);
  return client;
}

export function clearClientCache(port?: number) {
  if (port) {
    clientCache.delete(port);
  } else {
    clientCache.clear();
  }
}
