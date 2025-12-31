import useSWR, { mutate } from "swr";
import type {
  Message,
  Part,
  ToolPart,
  ToolState,
  TextPart,
} from "@opencode-ai/sdk";
import { useInstanceStore } from "@/stores/instance-store";

export type { Message, Part, ToolPart, ToolState, TextPart };

export interface MessageWithParts {
  info: Message;
  parts: Part[];
  isQueued?: boolean;
}

const fetcher = async (url: string): Promise<MessageWithParts[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch messages");
  }
  const data = await response.json();
  return data || [];
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
  } = useSWR<MessageWithParts[]>(key, fetcher, {
    refreshInterval: 3000,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  return {
    messages: data || [],
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

export function addOptimisticMessage(
  port: number,
  sessionId: string,
  message: MessageWithParts,
): () => void {
  const key = getMessagesKey(port, sessionId);
  let previousMessages: MessageWithParts[] = [];

  mutate(
    key,
    (current: MessageWithParts[] | undefined) => {
      previousMessages = current || [];
      return [...previousMessages, message];
    },
    { revalidate: false },
  );

  return () => {
    mutate(key, previousMessages, { revalidate: false });
  };
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
    (current: MessageWithParts[] | undefined) => {
      if (!current) return current;
      return current.map((m) =>
        m.info.id === messageId ? { ...m, ...updates } : m,
      );
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
    (current: MessageWithParts[] | undefined) => {
      if (!current) return current;
      return current.filter((m) => m.info.id !== messageId);
    },
    { revalidate: false },
  );
}
