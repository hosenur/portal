import { defineHandler } from "nitro/h3";
import { getCodexClient } from "../../lib/codex-client";
import { parsePort } from "../../lib/validation";

export default defineHandler((event) => {
  const port = parsePort(event);
  return getCodexClient(port).getPendingPermissions();
});
