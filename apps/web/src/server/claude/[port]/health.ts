import { defineHandler } from "nitro/h3";
import { getClaudeClient } from "../../lib/claude-client";
import { parsePort } from "../../lib/validation";

export default defineHandler((event) => {
  const port = parsePort(event);
  return getClaudeClient(port).getHealth();
});
