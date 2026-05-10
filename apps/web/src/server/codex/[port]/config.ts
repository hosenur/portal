import { defineHandler } from "nitro/h3";
import { getCodexClient } from "../../lib/codex-client";
import { parsePort } from "../../lib/validation";

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const client = getCodexClient(port);
  return client.request("config/read", { includeLayers: false });
});
