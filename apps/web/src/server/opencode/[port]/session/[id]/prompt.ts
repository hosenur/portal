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
      variant: z.string().optional(),
    })
    .optional(),
  agent: z.string().optional(),
  subagents: z.array(z.string()).default([]),
});

type AgentPartInput = { type: "agent"; name: string };
type TextPartInput = { type: "text"; text: string };
type PromptPart = AgentPartInput | TextPartInput;

// Build a prompt `parts` array that turns `@subagent` mentions into
// OpenCode agent parts. Text segments and agent mentions are emitted in
// document order so the subagent is actually delegated work.
function buildPromptParts(
  text: string,
  subagentNames: string[],
): PromptPart[] {
  if (subagentNames.length === 0) {
    return [{ type: "text", text }];
  }

  const escaped = subagentNames
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length)
    .join("|");
  const mentionRegex = new RegExp(`@(${escaped})\\b`, "g");

  const parts: PromptPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      parts.push({ type: "text", text: before });
    }
    parts.push({ type: "agent", name: match[1] });
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) {
    parts.push({ type: "text", text: remaining });
  }

  return parts.length > 0 ? parts : [{ type: "text", text }];
}

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
    const requestedSubagents = Array.from(
      new Set(body.subagents.map((name) => name.trim()).filter(Boolean)),
    );

    const agentNames = new Set<string>();
    if (requestedSubagents.length > 0) {
      try {
        const agentList = await client.app.agents();
        for (const agent of agentList.data ?? []) {
          if (agent.mode === "subagent") {
            agentNames.add(agent.name);
          }
        }
      } catch {
        // If we can't resolve the agent list, fall back to sending the
        // mention in text only.
      }
    }

    const mentionable = requestedSubagents.filter((name) =>
      agentNames.has(name),
    );

    const promptInput = {
      sessionID: id,
      messageID: body.messageID,
      parts: buildPromptParts(body.text, mentionable),
      model: body.model
        ? {
            providerID: body.model.providerID,
            modelID: body.model.modelID,
          }
        : undefined,
      variant: body.model?.variant,
      agent: body.agent,
    };

    await client.session.promptAsync(promptInput);
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
