import { defineHandler } from "nitro/h3";
import { getOpencodeClient } from "../../../lib/opencode-client";
import { parsePort } from "../../../lib/validation";

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const client = getOpencodeClient(port);
  const result = await client.project.current();

  return result.data;
});
