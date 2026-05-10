import { defineHandler } from "nitro/h3";
import { getCodexClient } from "../../../lib/codex-client";
import { parsePort } from "../../../lib/validation";

interface ThreadListResponse {
  data?: Array<{ id: string; status?: { type: string } }>;
}

function statusToSessionStatus(status: { type: string } | undefined) {
  return status?.type === "active" ? { type: "busy" } : { type: "idle" };
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

  return Object.fromEntries(
    (response.data ?? []).map((thread) => [
      thread.id,
      statusToSessionStatus(thread.status),
    ]),
  );
});
