import { z } from "zod/v4";
import { defineHandler } from "nitro/h3";
import {
  codexThreadToSession,
  getCodexClient,
  type CodexThread,
} from "../../../lib/codex-client";
import { parseBody, parsePort } from "../../../lib/validation";

const createSessionSchema = z.object({
  title: z.string().optional(),
  parentID: z.string().optional(),
});

interface ThreadStartResponse {
  thread: unknown;
}

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const body = await parseBody(event, createSessionSchema);
  const client = getCodexClient(port);
  const params: Record<string, unknown> = {
    serviceName: "openportal",
  };
  if (client.directory) {
    params.cwd = client.directory;
  }

  const response = await client.request<ThreadStartResponse>(
    "thread/start",
    params,
  );

  if (body.title) {
    await client.request("thread/name/set", {
      threadId: (response.thread as { id: string }).id,
      name: body.title,
    });
  }

  return codexThreadToSession(response.thread as CodexThread);
});
