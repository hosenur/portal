import { defineHandler } from "nitro/h3";
import {
  codexThreadToSession,
  getCodexClient,
  type CodexThread,
} from "../../../../lib/codex-client";
import { parsePort, parseRouteParam } from "../../../../lib/validation";

interface ThreadReadResponse {
  thread: CodexThread;
}

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const id = parseRouteParam(event, "id");
  const client = getCodexClient(port);
  const response = await client.request<ThreadReadResponse>("thread/read", {
    threadId: id,
    includeTurns: false,
  });

  return codexThreadToSession(response.thread);
});
