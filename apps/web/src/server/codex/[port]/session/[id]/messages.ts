import { defineHandler } from "nitro/h3";
import {
  codexThreadToSessionMessages,
  getCodexClient,
  isCodexThreadNotReadyError,
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
  let response: ThreadReadResponse;
  try {
    response = await client.request<ThreadReadResponse>("thread/read", {
      threadId: id,
      includeTurns: true,
    });
  } catch (error) {
    if (isCodexThreadNotReadyError(error)) {
      return [];
    }
    throw error;
  }

  return codexThreadToSessionMessages(response.thread);
});
