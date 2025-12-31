import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, memo } from "react";
import Markdown from "react-markdown";
import { Ripples } from "ldrs/react";
import "ldrs/react/Ripples.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/ui/loader";
import { ModelSelect } from "@/components/model-select";
import IconBadgeSparkle from "@/components/icons/badge-sparkle-icon";
import IconUser from "@/components/icons/user-icon";
import IconMagnifier from "@/components/icons/magnifier-icon";
import IconEye from "@/components/icons/eye-icon";
import IconPen from "@/components/icons/pen-icon";
import IconSquareFeather from "@/components/icons/feather-icon";
import SendIcon from "@/components/icons/send-icon";
import { useInstanceStore } from "@/stores/instance-store";
import { useModelStore } from "@/stores/model-store";
import {
  useSessionMessages,
  addOptimisticMessage,
  updateOptimisticMessage,
  removeOptimisticMessage,
  mutateSessionMessages,
  type MessageWithParts,
  type Part,
  type ToolPart,
} from "@/hooks/use-session-messages";
import { useSessions } from "@/hooks/use-opencode";

export const Route = createFileRoute("/_app/session/$id")({
  component: SessionPage,
});

interface QueuedMessage {
  id: string;
  text: string;
}

function isToolPart(part: Part): part is ToolPart {
  return part.type === "tool";
}

function formatToolCall(part: ToolPart): {
  icon: React.ReactNode;
  label: string;
  details?: string;
} {
  const toolName = part.tool?.toLowerCase() || "";
  const input = (part.state?.input || {}) as Record<string, unknown>;

  switch (toolName) {
    case "edit": {
      const filePath = input.filePath || input.file || "";
      const oldStr = String(input.oldString || "");
      const newStr = String(input.newString || "");
      const additions = newStr.split("\n").length;
      const deletions = oldStr.split("\n").length;
      return {
        icon: <IconPen size="12px" />,
        label: `edit ${filePath}`,
        details: `(+${additions}-${deletions})`,
      };
    }
    case "read": {
      const filePath = input.filePath || input.file || "";
      return {
        icon: <IconEye size="12px" />,
        label: `read ${filePath}`,
      };
    }
    case "write": {
      const filePath = input.filePath || input.file || "";
      const content = String(input.content || "");
      const lines = content.split("\n").length;
      return {
        icon: <IconSquareFeather size="12px" />,
        label: `write ${filePath}`,
        details: `(${lines} lines)`,
      };
    }
    case "bash": {
      const command = String(input.command || input.cmd || "");
      const shortCmd = command.split("\n")[0]?.slice(0, 50) || "";
      return {
        icon: "$",
        label: `bash ${shortCmd}${command.length > 50 ? "..." : ""}`,
        details: input.description ? `# ${input.description}` : undefined,
      };
    }
    case "glob": {
      const pattern = input?.pattern || "";
      const path = input?.path || "";
      return {
        icon: <IconMagnifier size="12px" />,
        label: `glob ${pattern}`,
        details: path ? `in ${path}` : undefined,
      };
    }
    case "grep": {
      const pattern = input.pattern || "";
      const path = input.path || "";
      return {
        icon: "◼︎",
        label: `grep "${pattern}"`,
        details: path ? `in ${path}` : undefined,
      };
    }
    default: {
      const firstArg = Object.entries(input)[0];
      return {
        icon: "◼︎",
        label: toolName || "unknown",
        details: firstArg
          ? `${firstArg[0]}: ${String(firstArg[1]).slice(0, 30)}...`
          : undefined,
      };
    }
  }
}

function getMessageContent(parts: Part[]): string {
  return parts
    .filter(
      (part): part is Part & { type: "text"; text: string } =>
        part.type === "text" && "text" in part && !!part.text?.trim(),
    )
    .map((part) => part.text)
    .join("\n\n");
}

const ToolCallItem = memo(function ToolCallItem({ part }: { part: ToolPart }) {
  const { icon, label, details } = formatToolCall(part);
  const isCompleted = part.state.status === "completed";
  const isError = part.state.status === "error";
  const isPending =
    part.state.status === "pending" || part.state.status === "running";

  return (
    <div
      className={`font-mono text-xs flex items-center gap-1.5 py-0.5 min-w-0 ${
        isError
          ? "text-danger"
          : isCompleted
            ? "text-muted-fg"
            : isPending
              ? "text-warning"
              : "text-fg"
      }`}
    >
      <span className="opacity-60 shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      {details && <span className="opacity-60 shrink-0">{details}</span>}
      {isPending && <span className="animate-pulse shrink-0">...</span>}
    </div>
  );
});

const MessageItem = memo(function MessageItem({
  message,
}: {
  message: MessageWithParts;
}) {
  const textContent = getMessageContent(message.parts);
  const isAssistant = message.info.role === "assistant";
  const toolCalls = message.parts.filter(isToolPart);

  return (
    <div className="py-3 px-6">
      {textContent && (
        <div className="flex gap-2">
          {isAssistant ? (
            <IconBadgeSparkle size="16px" className="shrink-0 mt-1" />
          ) : (
            <IconUser size="16px" className="shrink-0 mt-1" />
          )}
          <div className="flex-1">
            {!isAssistant && message.isQueued && (
              <Badge intent="warning" className="mb-1">
                Queued
              </Badge>
            )}
            <div
              className={`prose prose-sm dark:prose-invert max-w-none overflow-x-hidden ${!isAssistant ? "text-muted-fg" : ""}`}
            >
              <Markdown>{textContent}</Markdown>
            </div>
          </div>
        </div>
      )}
      {toolCalls.length > 0 && (
        <div className={`${textContent ? "mt-2 ml-6" : ""} space-y-0.5`}>
          {toolCalls.map((part) => (
            <ToolCallItem key={part.callID || part.id} part={part} />
          ))}
        </div>
      )}
    </div>
  );
});

function hasVisibleContent(message: MessageWithParts): boolean {
  const textContent = getMessageContent(message.parts);
  const hasToolCalls = message.parts.some(isToolPart);
  return !!(textContent || hasToolCalls);
}

function SessionPage() {
  const { id: sessionId } = Route.useParams();
  const instance = useInstanceStore((s) => s.instance);
  const port = instance?.port ?? 0;

  const {
    messages,
    isLoading: loading,
    error: messagesError,
  } = useSessionMessages(sessionId);
  const { mutate: mutateSessions } = useSessions();
  const selectedModel = useModelStore((s) => s.selectedModel);

  const [sendError, setSendError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const [hasScrolledInitially, setHasScrolledInitially] = useState(false);
  const isProcessingQueue = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);

  const error = messagesError?.message || sendError;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const checkIfNearBottom = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return true;

    const threshold = 100;
    const isNear =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;
    isNearBottomRef.current = isNear;
    return isNear;
  }, []);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkIfNearBottom();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [checkIfNearBottom]);

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      if (isNearBottomRef.current) {
        setTimeout(() => {
          scrollToBottom();
        }, 50);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (!hasScrolledInitially && !loading && messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
        setHasScrolledInitially(true);
        isNearBottomRef.current = true;
      }, 100);
    }
  }, [hasScrolledInitially, loading, messages.length, scrollToBottom]);

  useEffect(() => {
    setHasScrolledInitially(false);
    isNearBottomRef.current = true;
  }, [sessionId]);

  const sendMessage = useCallback(
    async (messageText: string, messageId: string) => {
      if (!sessionId || !port) return;

      try {
        const response = await fetch(
          `/api/opencode/${port}/session/${sessionId}/prompt`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: messageText, model: selectedModel }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        mutateSessionMessages(port, sessionId);
        isNearBottomRef.current = true;
        mutateSessions();
      } catch (err) {
        setSendError(
          err instanceof Error ? err.message : "Failed to send message",
        );
        removeOptimisticMessage(port, sessionId, messageId);
      }
    },
    [sessionId, port, mutateSessions, selectedModel],
  );

  const processQueue = useCallback(async () => {
    if (isProcessingQueue.current || !sessionId || !port) return;

    isProcessingQueue.current = true;
    setSending(true);

    while (true) {
      let nextMessage: QueuedMessage | undefined;
      setMessageQueue((prev) => {
        if (prev.length === 0) {
          nextMessage = undefined;
          return prev;
        }
        nextMessage = prev[0];
        return prev.slice(1);
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      if (!nextMessage) break;

      updateOptimisticMessage(port, sessionId, nextMessage.id, {
        isQueued: false,
      });
      await sendMessage(nextMessage.text, nextMessage.id);
    }

    isProcessingQueue.current = false;
    setSending(false);
  }, [sessionId, port, sendMessage]);

  useEffect(() => {
    if (messageQueue.length > 0 && !isProcessingQueue.current) {
      processQueue();
    }
  }, [messageQueue, processQueue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || !port) return;

    const messageText = input.trim();
    const messageId = `temp-${Date.now()}`;
    setInput("");
    setSendError(null);

    const shouldQueue = sending || messageQueue.length > 0;

    const optimisticMessage: MessageWithParts = {
      info: {
        id: messageId,
        sessionID: sessionId,
        role: "user",
        time: { created: Date.now() },
        agent: "user",
        model: { providerID: "", modelID: "" },
      },
      parts: [
        {
          id: `${messageId}-part`,
          sessionID: sessionId,
          messageID: messageId,
          type: "text",
          text: messageText,
        },
      ],
      isQueued: shouldQueue,
    };
    addOptimisticMessage(port, sessionId, optimisticMessage);

    setMessageQueue((prev) => [...prev, { id: messageId, text: messageText }]);

    isNearBottomRef.current = true;
    scrollToBottom();
  };

  return (
    <div className="flex h-full flex-col -m-4">
      <div
        className="flex-1 overflow-auto overflow-x-hidden"
        ref={chatContainerRef}
      >
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader className="size-6" />
          </div>
        )}

        {error && (
          <div className="rounded-md bg-danger-subtle p-4 m-4 text-danger-subtle-fg">
            Error: {error}
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-fg">No messages yet</div>
          </div>
        )}

        <div className="divide-y divide-dashed divide-border overflow-x-hidden">
          {messages
            .filter((message) => hasVisibleContent(message))
            .map((message) => (
              <MessageItem key={message.info.id} message={message} />
            ))}
          <div ref={messagesEndRef} />
        </div>

        {sending && (
          <div className="py-3 px-6">
            <div className="flex items-center gap-2">
              <Ripples size="30" speed="2" color="var(--color-primary)" />
              <span className="text-sm text-muted-fg">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-4 shrink-0">
        <form onSubmit={handleSubmit} className="w-full">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim()) {
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }
            }}
            placeholder="Type your message..."
            className="w-full resize-none min-h-32 max-h-32 overflow-y-auto"
            rows={5}
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <ModelSelect />
            <Button
              type="submit"
              isDisabled={!input.trim()}
              className="min-w-32"
            >
              <SendIcon size="16px" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
