import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { getOpencodeClient } from "../../../../lib/opencode-client";

interface PromptBody {
  text: string;
  model?: {
    providerID: string;
    modelID: string;
  };
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
  const result = await client.session.prompt({
    path: { id },
    body: {
      parts: [{ type: "text", text: body.text }],
      model: body.model,
    },
  });

  return result.data;
});
