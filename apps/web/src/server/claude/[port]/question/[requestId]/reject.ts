import { defineHandler } from "nitro/h3";
import { getClaudeClient } from "../../../../lib/claude-client";
import { parsePort, parseRouteParam } from "../../../../lib/validation";

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const requestId = parseRouteParam(event, "requestId");

  await getClaudeClient(port).rejectQuestion(requestId);
  return {};
});
