import { defineHandler } from "nitro/h3";
import { getCodexClient } from "../../lib/codex-client";
import { parsePort } from "../../lib/validation";

const encoder = new TextEncoder();

function encodeEvent(data: unknown) {
  return encoder.encode(`event: message\ndata: ${JSON.stringify(data)}\n\n`);
}

export default defineHandler((event) => {
  const port = parsePort(event);
  const client = getCodexClient(port);

  event.res.headers.set("Content-Type", "text/event-stream");
  event.res.headers.set("Cache-Control", "no-cache, no-transform");
  event.res.headers.set("Connection", "keep-alive");
  event.res.headers.set("X-Accel-Buffering", "no");
  event.res.headers.set("X-Content-Type-Options", "nosniff");

  let unsubscribe: (() => void) | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      unsubscribe = client.subscribe((item) => {
        controller.enqueue(encodeEvent(item));
      });
    },
    cancel() {
      unsubscribe?.();
      unsubscribe = null;
      // The shared Codex connection stays alive for other HTTP requests.
    },
  });
});
