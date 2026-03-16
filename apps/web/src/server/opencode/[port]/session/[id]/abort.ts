import { createError, defineHandler, getRouterParam } from "nitro/h3";
import { getOpencodeClient } from "../../../../lib/opencode-client";

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));
  const id = getRouterParam(event, "id");

  if (!port || isNaN(port)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid port" });
  }

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Session ID required" });
  }

  const client = getOpencodeClient(port);
  const result = await client.session.abort({ path: { id } });

  return result.data;
});
