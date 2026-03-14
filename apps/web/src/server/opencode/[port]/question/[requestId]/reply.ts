import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { getOpencodeBaseUrl } from "../../../../lib/opencode-client";

interface ReplyBody {
  answers: string[][];
}

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));
  const requestId = getRouterParam(event, "requestId");

  if (!port || isNaN(port)) {
    throw new Error("Invalid port");
  }

  if (!requestId) {
    throw new Error("Request ID required");
  }

  const body = await readBody<ReplyBody>(event);

  if (!body?.answers || !Array.isArray(body.answers)) {
    throw new Error("Answers array required");
  }

  const baseUrl = getOpencodeBaseUrl(port);
  const response = await fetch(`${baseUrl}/question/${requestId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: body.answers }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reply to question: ${response.statusText}`);
  }

  return response.json();
});
