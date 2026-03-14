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
    throw new Error("Invalid port");
  }

  if (!id) {
    throw new Error("Session ID required");
  }

  const body = await readBody<PromptBody>(event);

  if (!body?.text) {
    throw new Error("Message text required");
  }

  const client = getOpencodeClient(port);
  try {
    const result = await client.session.prompt({
      path: { id },
      body: {
        parts: [{ type: "text", text: body.text }],
        model: body.model,
        agent: body.agent,
      },
    });

    return result.data;
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.message.toLowerCase().includes("timed out"));

    if (isTimeout) {
      const asyncResult = await client.session.promptAsync({
        path: { id },
        body: {
          parts: [{ type: "text", text: body.text }],
          model: body.model,
          agent: body.agent,
        },
      });
      return asyncResult.data;
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Prompt failed",
    });
  }
});
