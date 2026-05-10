import { defineHandler, getQuery } from "nitro/h3";
import { getClaudeClient } from "../../../lib/claude-client";
import { parsePort } from "../../../lib/validation";

export default defineHandler((event) => {
  const port = parsePort(event);
  const query = String(getQuery(event).q ?? "").trim();
  return getClaudeClient(port).searchFiles(query);
});
