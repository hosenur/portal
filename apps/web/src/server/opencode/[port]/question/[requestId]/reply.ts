import type { QuestionAnswer } from "@opencode-ai/sdk/v2/client";
import { createError, defineHandler, getRouterParam, readBody } from "nitro/h3";
import { getOpencodeClientV2 } from "../../../../lib/opencode-client";

interface QuestionReplyBody {
  answers: QuestionAnswer[];
}

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));
  const requestId = getRouterParam(event, "requestId");

  if (!port || isNaN(port)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid port" });
  }

  if (!requestId) {
    throw createError({ statusCode: 400, statusMessage: "Request ID required" });
  }

  const body = await readBody<QuestionReplyBody>(event);

  if (!body?.answers || !Array.isArray(body.answers)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Answers array required",
    });
  }

  const client = getOpencodeClientV2(port);
  const result = await client.question.reply({
    requestID: requestId,
    answers: body.answers,
  });

  return result.data;
});
