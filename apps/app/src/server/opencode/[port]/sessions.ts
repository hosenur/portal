import { defineHandler, getRouterParam } from "nitro/h3";
import { getOpencodeClient } from "../../lib/opencode-client";

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));

  if (!port || isNaN(port)) {
    throw new Error("Invalid port");
  }

  const client = getOpencodeClient(port);
  const sessions = await client.session.list();

  return sessions.data;
});
