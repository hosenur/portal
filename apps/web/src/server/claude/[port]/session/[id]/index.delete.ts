import { defineHandler } from "nitro/h3";
import { getClaudeClient } from "../../../../lib/claude-client";
import { parsePort, parseRouteParam } from "../../../../lib/validation";

export default defineHandler((event) => {
  const port = parsePort(event);
  const id = parseRouteParam(event, "id");
  return getClaudeClient(port).deleteSession(id);
});
