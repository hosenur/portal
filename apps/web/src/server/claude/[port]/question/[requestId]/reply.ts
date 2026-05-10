import { z } from "zod/v4";
import { defineHandler } from "nitro/h3";
import { getClaudeClient } from "../../../../lib/claude-client";
import {
  parseBody,
  parsePort,
  parseRouteParam,
} from "../../../../lib/validation";

const questionReplySchema = z.object({
  answers: z.array(z.array(z.string())),
});

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const requestId = parseRouteParam(event, "requestId");
  const body = await parseBody(event, questionReplySchema);

  await getClaudeClient(port).replyQuestion(requestId, body.answers);
  return {};
});
