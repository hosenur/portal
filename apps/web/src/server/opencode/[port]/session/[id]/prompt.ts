import { createError, defineHandler, getRouterParam, readBody } from "nitro/h3";
import { getOpencodeClient } from "../../../../lib/opencode-client";

interface PromptBody {
  text: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  agent?: string;
}

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));
  const id = getRouterParam(event, "id");

  if (!port || isNaN(port)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid port" });
  }

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Session ID required" });
  }

  const body = await readBody<PromptBody>(event);

  if (!body?.text) {
    throw createError({ statusCode: 400, statusMessage: "Message text required" });
  }

  const client = getOpencodeClient(port);
  const promptBody = {
    parts: [{ type: "text" as const, text: body.text }],
    model: body.model,
    agent: body.agent,
  };

  try {
    const result = await client.session.prompt({
      path: { id },
      body: promptBody,
    });
    return result.data;
  } catch (error) {
    // On timeout, fall back to async prompt which returns immediately
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.cause instanceof DOMException);

    if (isTimeout) {
      const asyncResult = await client.session.promptAsync({
        path: { id },
        body: promptBody,
      });
      return asyncResult.data;
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Prompt failed",
    });
  }
});
