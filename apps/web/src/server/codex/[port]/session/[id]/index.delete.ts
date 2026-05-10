import { defineHandler } from "nitro/h3";
import { getCodexClient } from "../../../../lib/codex-client";
import { parsePort, parseRouteParam } from "../../../../lib/validation";

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const id = parseRouteParam(event, "id");
  const client = getCodexClient(port);

  await client.request("thread/archive", { threadId: id });
  return { id };
});
