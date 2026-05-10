import { z } from "zod/v4";
import { defineHandler } from "nitro/h3";
import { getCodexClient } from "../../../../lib/codex-client";
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

  await getCodexClient(port).replyQuestion(requestId, body.answers);
  return {};
});
