import { HTTPError, defineHandler } from "nitro/h3";
import {
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
      throw new HTTPError("No active Codex turn to abort", { status: 409 });
    }
    throw error;
  }
  const activeTurn = response.thread.turns?.find(
    (turn) => turn.status === "inProgress",
  );

  if (!activeTurn) {
    throw new HTTPError("No active Codex turn to abort", { status: 409 });
  }

  await client.request("turn/interrupt", {
    threadId: id,
    turnId: activeTurn.id,
  });

  return { id };
});
