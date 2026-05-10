import { z } from "zod/v4";
import { HTTPError, defineHandler } from "nitro/h3";
import { formatErrorMessage } from "@/lib/error-message";
import {
  getCodexClient,
  isCodexThreadNotReadyError,
} from "../../../../lib/codex-client";
import {
  parseBody,
  parsePort,
  parseRouteParam,
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

  const client = getCodexClient(port);
  try {
    const resumeParams: Record<string, unknown> = {
      threadId: id,
      ...(body.model?.modelID
        ? {
            model: body.model.modelID,
            modelProvider: body.model.providerID || "openai",
          }
        : {}),
    };
    if (client.directory) {
      resumeParams.cwd = client.directory;
    }
    const turnParams = {
      threadId: id,
      input: [{ type: "text", text: body.text, text_elements: [] }],
      ...(body.model?.modelID ? { model: body.model.modelID } : {}),
    };

    try {
      await client.request("turn/start", turnParams);
    } catch (error) {
      if (!isCodexThreadNotReadyError(error)) {
        throw error;
      }

      await client.request("thread/resume", resumeParams);
      await client.request("turn/start", turnParams);
    }
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
