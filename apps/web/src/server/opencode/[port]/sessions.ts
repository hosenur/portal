import { defineHandler } from "nitro/h3";
import { getOpencodeClient } from "../../lib/opencode-client";
import { parsePort } from "../../lib/validation";

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const client = getOpencodeClient(port);
  const sessions = await client.session.list();

  return sessions.data;
});
