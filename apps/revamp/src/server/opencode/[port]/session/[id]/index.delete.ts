import { defineHandler, getRouterParam } from "nitro/h3";
import { getOpencodeClient } from "../../../../lib/opencode-client";

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));
  const id = getRouterParam(event, "id");

  if (!port || isNaN(port)) {
    throw new Error("Invalid port");
  }

  if (!id) {
    throw new Error("Session ID required");
  }

  const client = getOpencodeClient(port);
  const result = await client.session.delete({ path: { id } });

  return result.data;
});
