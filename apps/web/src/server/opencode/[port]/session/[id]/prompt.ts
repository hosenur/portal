import { z } from "zod/v4";
import { HTTPError, defineHandler } from "nitro/h3";
import { getOpencodeClient } from "../../../../lib/opencode-client";
import { parsePort, parseRouteParam, parseBody } from "../../../../lib/validation";

const promptBodySchema = z.object({
  text: z.string().min(1),
  model: z
    .object({
      providerID: z.string(),
      modelID: z.string(),
    })
    .optional(),
  agent: z.string().optional(),
});

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const id = parseRouteParam(event, "id");
  const body = await parseBody(event, promptBodySchema);

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

    throw new HTTPError(error instanceof Error ? error.message : "Prompt failed", {
      status: 500,
    });
  }
});
