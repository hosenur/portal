import { defineHandler } from "nitro/h3";
import { getOpencodeClient } from "../../lib/opencode-client";
import { parsePort } from "../../lib/validation";

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const client = getOpencodeClient(port);
  const config = await client.config.get();

  return config.data;
});
