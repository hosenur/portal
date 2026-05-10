import { z } from "zod/v4";
import { defineHandler } from "nitro/h3";
import { getClaudeClient } from "../../../lib/claude-client";
import { parseBody, parsePort } from "../../../lib/validation";

const createSessionSchema = z.object({
  title: z.string().optional(),
  parentID: z.string().optional(),
});

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const body = await parseBody(event, createSessionSchema);
  return getClaudeClient(port).createSession(body.title);
});
