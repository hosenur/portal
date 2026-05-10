import { defineHandler } from "nitro/h3";
import {
  codexThreadToSession,
  getCodexClient,
  type CodexThread,
} from "../../lib/codex-client";
import { parsePort } from "../../lib/validation";

interface ThreadListResponse {
  data?: unknown[];
}

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const client = getCodexClient(port);
  const params: Record<string, unknown> = {
    limit: 100,
  };
  if (client.directory) {
    params.cwd = client.directory;
  }
  const response = await client.request<ThreadListResponse>(
    "thread/list",
    params,
  );

  return (response.data ?? []).map((thread) =>
    codexThreadToSession(thread as CodexThread),
  );
});
