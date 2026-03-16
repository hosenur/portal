import { createError, defineHandler, getRouterParam } from "nitro/h3";
import { getOpencodeClientV2 } from "../../lib/opencode-client";

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));

  if (!port || isNaN(port)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid port" });
  }

  const client = getOpencodeClientV2(port);
  const result = await client.permission.list();

  return result.data;
});
