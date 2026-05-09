import { useMemo } from "react";
import useSWR, { mutate } from "swr";
import type {
  Message,
  Part,
  FilePart,
  ToolPart,
  ToolState,
  TextPart,
  ReasoningPart,
  PermissionRequest,
  QuestionAnswer,
  QuestionInfo,
  QuestionOption,
  QuestionRequest,
  SessionMessage,
  SessionMessageAssistant,
  SessionMessageAssistantTool,
  SessionMessageShell,
  ToolFileContent,
  ToolTextContent,
} from "@opencode-ai/sdk/v2";
import { useInstanceStore } from "@/stores/instance-store";
import { getErrorMessage } from "@/lib/error-message";

export type { Message, Part, ToolPart, ToolState, TextPart, PermissionRequest, QuestionAnswer, QuestionInfo, QuestionOption, QuestionRequest, SessionMessage };

export interface MessageWithParts {
  info: Message;
  parts: Part[];
  isQueued?: boolean;
}

type LegacyAssistantMessage = Extract<Message, { role: "assistant" }>;
type LegacyUserMessage = Extract<Message, { role: "user" }>;
type ToolContent = ToolTextContent | ToolFileContent;
type AssistantError = NonNullable<SessionMessageAssistant["error"]>;

const EMPTY_TOKENS = {
  total: 0,
  input: 0,
  output: 0,
  reasoning: 0,
  cache: {
    read: 0,
    write: 0,
  },
};

const fetcher = async (url: string): Promise<SessionMessage[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch messages");
  }
  const data = await response.json();
  return normalizeFetchedMessages(data);
};

function usePort() {
  const instance = useInstanceStore((s) => s.instance);
  return instance?.port ?? null;
}

export function useSessionMessages(sessionId: string | undefined) {
  const port = usePort();
  const key =
    port && sessionId
      ? `/api/opencode/${port}/session/${sessionId}/messages`
      : null;

  const {
    data,
    error,
    isLoading,
    mutate: boundMutate,
  } = useSWR<SessionMessage[]>(key, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const messages = useMemo(
    () => (sessionId ? sessionMessagesToLegacy(data ?? [], sessionId) : []),
    [data, sessionId],
  );

  return {
    messages,
    sessionMessages: data || [],
    error,
    isLoading,
    mutate: boundMutate,
  };
}

export function getMessagesKey(port: number, sessionId: string) {
  return `/api/opencode/${port}/session/${sessionId}/messages`;
}

export function mutateSessionMessages(port: number, sessionId: string) {
  mutate(getMessagesKey(port, sessionId));
}

export function sortSessionMessages(messages: SessionMessage[]) {
  return [...messages].sort(
    (a, b) => a.time.created - b.time.created || a.id.localeCompare(b.id),
  );
}

function normalizeFetchedMessages(data: unknown) {
  const messages = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.items)
      ? data.items
      : [];

  if (messages.some(isMessageWithParts)) {
    return sortSessionMessages(
      messages.filter(isMessageWithParts).map(legacyMessageToSessionMessage),
    );
  }

  return sortSessionMessages(messages as SessionMessage[]);
}

function isMessageWithParts(value: unknown): value is MessageWithParts {
  return (
    isRecord(value) &&
    isRecord(value.info) &&
    Array.isArray(value.parts) &&
    (value.info.role === "user" || value.info.role === "assistant")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function contentToText(content: ToolContent[] | undefined) {
  return (content ?? [])
    .map((item) => {
      if (item.type === "text") return item.text;
      return item.name || item.uri;
    })
    .filter(Boolean)
    .join("\n");
}

function legacyTextFromParts(parts: Part[]) {
  return parts
    .filter(
      (part): part is TextPart =>
        part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("\n\n");
}

function toolContentFromOutput(output?: string): ToolTextContent[] {
  return output ? [{ type: "text", text: output }] : [];
}

function legacyToolInput(input: Record<string, unknown> | undefined) {
  return isRecord(input) ? input : {};
}

function legacyToolStateToSession(
  state: ToolState,
): SessionMessageAssistantTool["state"] {
  switch (state.status) {
    case "pending":
      return {
        status: "pending",
        input: state.raw,
      };

    case "running":
      return {
        status: "running",
        input: legacyToolInput(state.input),
        structured: state.metadata ?? {},
        content: [],
      };

    case "completed":
      return {
        status: "completed",
        input: legacyToolInput(state.input),
        structured: state.metadata ?? {},
        content: toolContentFromOutput(state.output),
        attachments: state.attachments?.map((attachment) => ({
          uri: attachment.url,
          mime: attachment.mime,
          ...(attachment.filename ? { name: attachment.filename } : {}),
        })),
      };

    case "error":
      return {
        status: "error",
        input: legacyToolInput(state.input),
        structured: state.metadata ?? {},
        content: [],
        error: {
          type: "unknown",
          message: state.error,
        },
      };
  }
}

function legacyToolTime(part: ToolPart, fallback: number) {
  const state = part.state;
  switch (state.status) {
    case "pending":
      return { created: fallback };

    case "running":
      return { created: state.time.start, ran: state.time.start };

    case "completed":
      return {
        created: state.time.start,
        ran: state.time.start,
        completed: state.time.end,
      };

    case "error":
      return {
        created: state.time.start,
        ran: state.time.start,
        completed: state.time.end,
      };
  }
}

function legacyAssistantContent(
  message: MessageWithParts,
): SessionMessageAssistant["content"] {
  const content: SessionMessageAssistant["content"] = [];

  message.parts.forEach((part) => {
    if (part.type === "text") {
      content.push({ type: "text", text: part.text });
      return;
    }

    if (part.type === "reasoning") {
      content.push({ type: "reasoning", id: part.id, text: part.text });
      return;
    }

    if (part.type === "tool") {
      content.push({
        type: "tool",
        id: part.callID,
        name: part.tool,
        provider: {
          executed: part.state.status !== "pending",
          metadata: part.metadata,
        },
        time: legacyToolTime(part, message.info.time.created),
        state: legacyToolStateToSession(part.state),
      });
    }
  });

  return content;
}

function legacyTokensToSession(
  tokens: LegacyAssistantMessage["tokens"] | undefined,
) {
  return {
    input: tokens?.input ?? 0,
    output: tokens?.output ?? 0,
    reasoning: tokens?.reasoning ?? 0,
    cache: {
      read: tokens?.cache.read ?? 0,
      write: tokens?.cache.write ?? 0,
    },
  };
}

function legacyMessageToSessionMessage(message: MessageWithParts): SessionMessage {
  if (message.info.role === "user") {
    return {
      id: message.info.id,
      type: "user",
      text: legacyTextFromParts(message.parts),
      time: message.info.time,
      ...(message.isQueued ? { metadata: { portalQueued: true } } : {}),
    };
  }

  const stepStart = message.parts.find((part) => part.type === "step-start");
  const stepFinish = message.parts.find((part) => part.type === "step-finish");
  const error = toAssistantError(message.info.error);

  return {
    id: message.info.id,
    type: "assistant",
    agent: message.info.agent,
    model: {
      id: message.info.modelID,
      providerID: message.info.providerID,
      variant: message.info.variant ?? message.info.mode ?? "default",
    },
    content: legacyAssistantContent(message),
    time: message.info.time,
    cost: message.info.cost,
    tokens: legacyTokensToSession(message.info.tokens),
    ...(message.info.finish ? { finish: message.info.finish } : {}),
    ...(error ? { error } : {}),
    ...(stepStart?.type === "step-start" || stepFinish?.type === "step-finish"
      ? {
          snapshot: {
            ...(stepStart?.type === "step-start" && stepStart.snapshot
              ? { start: stepStart.snapshot }
              : {}),
            ...(stepFinish?.type === "step-finish" && stepFinish.snapshot
              ? { end: stepFinish.snapshot }
              : {}),
          },
        }
      : {}),
  };
}

function legacyUserInfo(
  message: Extract<SessionMessage, { type: "user" }>,
  sessionId: string,
): LegacyUserMessage {
  return {
    id: message.id,
    sessionID: sessionId,
    role: "user",
    time: message.time,
    agent: "user",
    model: {
      providerID: "",
      modelID: "",
    },
  };
}

function legacyAssistantInfo(
  message: SessionMessageAssistant,
  sessionId: string,
): LegacyAssistantMessage {
  const tokens = message.tokens
    ? {
        ...message.tokens,
        total:
          message.tokens.input +
          message.tokens.output +
          message.tokens.reasoning,
      }
    : EMPTY_TOKENS;

  return {
    id: message.id,
    sessionID: sessionId,
    role: "assistant",
    time: message.time,
    parentID: "",
    modelID: message.model.id,
    providerID: message.model.providerID,
    mode: message.model.variant,
    agent: message.agent,
    path: {
      cwd: "",
      root: "",
    },
    cost: message.cost ?? 0,
    tokens,
    ...(message.finish ? { finish: message.finish } : {}),
    ...(message.error
      ? {
          error: {
            name: "UnknownError",
            data: { message: message.error.message },
          },
        }
      : {}),
    ...(message.model.variant ? { variant: message.model.variant } : {}),
  };
}

function toAssistantError(error: unknown): AssistantError | undefined {
  const message = getErrorMessage(error);
  return message ? { type: "unknown", message } : undefined;
}

function syntheticAssistantInfo(
  message: Extract<SessionMessage, { type: "synthetic" }>,
  sessionId: string,
): LegacyAssistantMessage {
  return {
    id: message.id,
    sessionID: sessionId,
    role: "assistant",
    time: {
      created: message.time.created,
      completed: message.time.created,
    },
    parentID: "",
    modelID: "",
    providerID: "",
    mode: "synthetic",
    agent: "system",
    path: {
      cwd: "",
      root: "",
    },
    cost: 0,
    tokens: EMPTY_TOKENS,
  };
}

function shellAssistantInfo(
  message: SessionMessageShell,
  sessionId: string,
): LegacyAssistantMessage {
  return {
    id: message.id,
    sessionID: sessionId,
    role: "assistant",
    time: message.time,
    parentID: "",
    modelID: "",
    providerID: "",
    mode: "shell",
    agent: "shell",
    path: {
      cwd: "",
      root: "",
    },
    cost: 0,
    tokens: EMPTY_TOKENS,
  };
}

function textPart(
  id: string,
  sessionId: string,
  messageId: string,
  text: string,
  synthetic = false,
): TextPart {
  return {
    id,
    sessionID: sessionId,
    messageID: messageId,
    type: "text",
    text,
    ...(synthetic ? { synthetic: true } : {}),
  };
}

function reasoningPart(
  item: Extract<SessionMessageAssistant["content"][number], { type: "reasoning" }>,
  sessionId: string,
  message: SessionMessageAssistant,
): ReasoningPart {
  return {
    id: item.id,
    sessionID: sessionId,
    messageID: message.id,
    type: "reasoning",
    text: item.text,
    time: {
      start: message.time.created,
      ...(message.time.completed ? { end: message.time.completed } : {}),
    },
  };
}

function fileAttachments(
  attachments: Extract<
    SessionMessageAssistantTool["state"],
    { status: "completed" }
  >["attachments"],
  sessionId: string,
  messageId: string,
): FilePart[] {
  return (attachments ?? []).map((attachment, index) => ({
    id: `${messageId}-attachment-${index}`,
    sessionID: sessionId,
    messageID: messageId,
    type: "file",
    mime: attachment.mime,
    filename: attachment.name,
    url: attachment.uri,
  }));
}

function legacyToolState(tool: SessionMessageAssistantTool): ToolState {
  const start = tool.time.ran ?? tool.time.created;

  switch (tool.state.status) {
    case "pending":
      return {
        status: "pending",
        input: parseJsonRecord(tool.state.input),
        raw: tool.state.input,
      };

    case "running":
      return {
        status: "running",
        input: tool.state.input,
        title: tool.name,
        metadata: tool.state.structured,
        time: {
          start,
        },
      };

    case "completed":
      return {
        status: "completed",
        input: tool.state.input,
        output: contentToText(tool.state.content),
        title: tool.name,
        metadata: tool.state.structured,
        time: {
          start,
          end: tool.time.completed ?? start,
        },
      };

    case "error":
      return {
        status: "error",
        input: tool.state.input,
        error: tool.state.error.message,
        metadata: tool.state.structured,
        time: {
          start,
          end: tool.time.completed ?? start,
        },
      };
  }
}

function toolPart(
  tool: SessionMessageAssistantTool,
  sessionId: string,
  messageId: string,
): ToolPart {
  return {
    id: `${messageId}-${tool.id}`,
    sessionID: sessionId,
    messageID: messageId,
    type: "tool",
    callID: tool.id,
    tool: tool.name,
    state: legacyToolState(tool),
    ...(tool.provider?.metadata ? { metadata: tool.provider.metadata } : {}),
  };
}

function shellToolPart(
  message: SessionMessageShell,
  sessionId: string,
): ToolPart {
  const start = message.time.created;
  const state: ToolState = message.time.completed
    ? {
        status: "completed",
        input: { command: message.command },
        output: message.output,
        title: "bash",
        metadata: {},
        time: {
          start,
          end: message.time.completed,
        },
      }
    : {
        status: "running",
        input: { command: message.command },
        title: "bash",
        metadata: {},
        time: {
          start,
        },
      };

  return {
    id: `${message.id}-shell`,
    sessionID: sessionId,
    messageID: message.id,
    type: "tool",
    callID: message.callID,
    tool: "bash",
    state,
  };
}

function assistantParts(
  message: SessionMessageAssistant,
  sessionId: string,
): Part[] {
  const parts: Part[] = [];

  message.content.forEach((item, index) => {
    if (item.type === "text") {
      parts.push(
        textPart(`${message.id}-text-${index}`, sessionId, message.id, item.text),
      );
      return;
    }

    if (item.type === "reasoning") {
      parts.push(reasoningPart(item, sessionId, message));
      return;
    }

    parts.push(toolPart(item, sessionId, message.id));

    if (item.state.status === "completed") {
      parts.push(...fileAttachments(item.state.attachments, sessionId, message.id));
    }
  });

  return parts;
}

export function sessionMessagesToLegacy(
  messages: SessionMessage[],
  sessionId: string,
): MessageWithParts[] {
  return sortSessionMessages(messages).flatMap((message): MessageWithParts[] => {
    switch (message.type) {
      case "user":
        return [
          {
            info: legacyUserInfo(message, sessionId),
            parts: [
              textPart(`${message.id}-text`, sessionId, message.id, message.text),
            ],
            isQueued: message.metadata?.portalQueued === true,
          },
        ];

      case "assistant":
        return [
          {
            info: legacyAssistantInfo(message, sessionId),
            parts: assistantParts(message, sessionId),
          },
        ];

      case "synthetic":
        return [
          {
            info: syntheticAssistantInfo(message, sessionId),
            parts: [
              textPart(
                `${message.id}-synthetic`,
                sessionId,
                message.id,
                message.text,
                true,
              ),
            ],
          },
        ];

      case "shell":
        return [
          {
            info: shellAssistantInfo(message, sessionId),
            parts: [shellToolPart(message, sessionId)],
          },
        ];

      case "agent-switched":
      case "model-switched":
      case "compaction":
        return [];
    }
  });
}

export function addOptimisticMessage(
  port: number,
  sessionId: string,
  message: MessageWithParts,
): () => void {
  const key = getMessagesKey(port, sessionId);
  let previousMessages: SessionMessage[] = [];
  const optimisticMessage: SessionMessage = {
    id: message.info.id,
    type: "user",
    text: legacyTextFromParts(message.parts),
    time: {
      created: message.info.time.created,
    },
    metadata: {
      portalOptimistic: true,
      portalPending: true,
      portalQueued: message.isQueued === true,
    },
  };

  mutate(
    key,
    (current: SessionMessage[] | undefined) => {
      previousMessages = current || [];
      return sortSessionMessages([...previousMessages, optimisticMessage]);
    },
    { revalidate: false },
  );

  return () => {
    mutate(key, previousMessages, { revalidate: false });
  };
}

export function reconcileOptimisticMessage(
  port: number,
  sessionId: string,
  optimisticId: string,
  actualMessage: SessionMessage,
) {
  const key = getMessagesKey(port, sessionId);

  mutate(
    key,
    (current: SessionMessage[] | undefined) => {
      const messages = current ?? [];
      const withoutOptimistic = messages.filter((message) => {
        if (message.id === optimisticId) return false;
        return !(
          actualMessage.type === "user" &&
          message.type === "user" &&
          message.text === actualMessage.text &&
          message.metadata?.portalOptimistic === true
        );
      });
      return sortSessionMessages([...withoutOptimistic, actualMessage]);
    },
    { revalidate: false },
  );
}

export function settleOptimisticMessage(
  port: number,
  sessionId: string,
  messageId: string,
) {
  const key = getMessagesKey(port, sessionId);

  mutate(
    key,
    (current: SessionMessage[] | undefined) => {
      if (!current) return current;
      return current.map((message) => {
        if (message.id !== messageId || message.type !== "user") return message;

        return {
          ...message,
          metadata: {
            ...(message.metadata ?? {}),
            portalPending: false,
            portalQueued: false,
          },
        };
      });
    },
    { revalidate: false },
  );
}

export function updateOptimisticMessage(
  port: number,
  sessionId: string,
  messageId: string,
  updates: Partial<MessageWithParts>,
) {
  const key = getMessagesKey(port, sessionId);

  mutate(
    key,
    (current: SessionMessage[] | undefined) => {
      if (!current) return current;
      return current.map((message) => {
        if (message.id !== messageId || message.type !== "user") return message;

        return {
          ...message,
          ...(updates.parts ? { text: legacyTextFromParts(updates.parts) } : {}),
          metadata: {
            ...(message.metadata ?? {}),
            ...("isQueued" in updates
              ? { portalQueued: updates.isQueued === true }
              : {}),
          },
        };
      });
    },
    { revalidate: false },
  );
}

export function removeOptimisticMessage(
  port: number,
  sessionId: string,
  messageId: string,
) {
  const key = getMessagesKey(port, sessionId);

  mutate(
    key,
    (current: SessionMessage[] | undefined) => {
      if (!current) return current;
      return current.filter((message) => message.id !== messageId);
    },
    { revalidate: false },
  );
}
