import { defineHandler } from "nitro/h3";
import { getOpencodeClientV2 } from "../../lib/opencode-client";
import { parsePort } from "../../lib/validation";

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const client = getOpencodeClientV2(port);
  const result = await client.permission.list();

  return result.data;
});
