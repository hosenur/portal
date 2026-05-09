import { z } from "zod/v4";
import { HTTPError, defineHandler } from "nitro/h3";
import { formatErrorMessage } from "@/lib/error-message";
import { getOpencodeClient } from "../../../../lib/opencode-client";
import {
  parsePort,
  parseRouteParam,
  parseBody,
} from "../../../../lib/validation";

const PROMPT_DEDUPE_TTL_MS = 2 * 60 * 1000;
const recentPromptRequests = new Map<string, number>();

const promptBodySchema = z.object({
  messageID: z.string().optional(),
  text: z.string().min(1),
  model: z
    .object({
      providerID: z.string(),
      modelID: z.string(),
    })
    .optional(),
  agent: z.string().optional(),
});

function prunePromptRequests(now: number) {
  for (const [key, expiresAt] of recentPromptRequests) {
    if (expiresAt <= now) {
      recentPromptRequests.delete(key);
    }
  }
}

function claimPromptRequest(key: string) {
  const now = Date.now();
  prunePromptRequests(now);

  const expiresAt = recentPromptRequests.get(key);
  if (expiresAt && expiresAt > now) {
    return false;
  }

  recentPromptRequests.set(key, now + PROMPT_DEDUPE_TTL_MS);
  return true;
}

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const id = parseRouteParam(event, "id");
  const body = await parseBody(event, promptBodySchema);
  const requestKey = body.messageID
    ? `${port}:${id}:${body.messageID}`
    : undefined;

  if (requestKey && !claimPromptRequest(requestKey)) {
    return {
      accepted: true,
      duplicate: true,
      mode: "legacy",
      messageID: body.messageID,
    };
  }

  const client = getOpencodeClient(port);
  try {
    await client.session.promptAsync({
      sessionID: id,
      messageID: body.messageID,
      parts: [{ type: "text" as const, text: body.text }],
      model: body.model,
      agent: body.agent,
    });
  } catch (error) {
    if (requestKey) {
      recentPromptRequests.delete(requestKey);
    }
    throw new HTTPError(formatErrorMessage(error, "Failed to send message"), {
      status: 500,
    });
  }

  return {
    accepted: true,
    mode: "legacy",
    messageID: body.messageID,
  };
});
