import { useEffect, useRef, useState, useCallback, memo, useMemo } from "react";
import { useRouter } from "next/router";
import Markdown from "react-markdown";
import NumberFlow from "@number-flow/react";
import AppLayout from "@/layouts/app-layout";
import { ModelSelect } from "@/components/model-select";
import { Textarea } from "@/components/ui/textarea";
import IconBadgeSparkle from "@/components/icons/badge-sparkle-icon";
import IconUser from "@/components/icons/user-icon";
import IconMagnifier from "@/components/icons/magnifier-icon";
import IconEye from "@/components/icons/eye-icon";
import IconPen from "@/components/icons/pen-icon";
import IconSquareFeather from "@/components/icons/feather-icon";
import SendIcon from "@/components/icons/send-icon";
import {
  FileMentionPopover,
  useFileMention,
} from "@/components/file-mention-popover";
import { Ripples } from "ldrs/react";
import "ldrs/react/Ripples.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSelectedModel } from "@/hooks/use-selected-model";
import { mutateSessions, useSession } from "@/hooks/use-sessions";
import { aggregateSessionUsage } from "@/hooks/use-session-usage";
import {
  useSessionMessages,
  addOptimisticMessage,
  updateOptimisticMessage,
  removeOptimisticMessage,
  mutateSessionMessages,
  type MessageWithParts,
} from "@/hooks/use-session-messages";
import type { Part, ToolPart } from "@opencode-ai/sdk";

interface QueuedMessage {
  id: string;
  text: string;
}

/**
 * Type guard to check if a part is a ToolPart
 */
function isToolPart(part: Part): part is ToolPart {
  return part.type === "tool";
}

/**
 * Format a tool call in CLI-style like OpenCode does
 * Examples:
 *   edit src/layouts/Layout.astro (+3-3)
 *   read src/layouts/Layout.astro
 *   bash npm install
 *   glob **\/*.tsx
 */
function formatToolCall(part: ToolPart): {
  icon: React.ReactNode;
  label: string;
  details?: string;
} {
  const toolName = part.tool?.toLowerCase() || "";
  const input = part.state.input || {};

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
      const command = input.command || input.cmd || "";
      const shortCmd = String(command).split("\n")[0].slice(0, 50);
      return {
        icon: "$",
        label: `bash ${shortCmd}${String(command).length > 50 ? "..." : ""}`,
        details: input.description ? `# ${input.description}` : undefined,
      };
    }
    case "glob": {
      const pattern = input.pattern || "";
      const path = input.path || "";
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
    case "list": {
      const path = input.path || ".";
      return {
        icon: "◼︎",
        label: `list ${path}`,
      };
    }
    case "task": {
      const description = input.description || "";
      return {
        icon: "▶",
        label: `task ${description}`,
      };
    }
    case "todowrite": {
      return {
        icon: "☐",
        label: "todowrite",
        details: "updating task list",
      };
    }
    case "todoread": {
      return {
        icon: "☐",
        label: "todoread",
      };
    }
    case "webfetch": {
      const url = input.url || "";
      return {
        icon: "◼︎",
        label: `webfetch ${url}`,
      };
    }
    default: {
      // For unknown tools, show tool name and first arg if available
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

  // Get tool calls
  const toolCalls = message.parts.filter(isToolPart);

  return (
    <div className="py-3 px-6">
      {/* Content with inline icon */}
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
      {/* Tool calls in CLI-style format */}
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

export default function SessionPage() {
  const router = useRouter();
  const { id } = router.query;
  const sessionId = typeof id === "string" ? id : undefined;

  // Use SWR for session and messages - handles fetching and caching automatically
  useSession(sessionId);
  const {
    messages,
    isLoading: loading,
    error: messagesError,
  } = useSessionMessages(sessionId);

  const [sendError, setSendError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [fileResults, setFileResults] = useState<string[]>([]);
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const [hasScrolledInitially, setHasScrolledInitially] = useState(false);
  const isProcessingQueue = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);

  const fileMention = useFileMention();
  const { selectedModel } = useSelectedModel();

  // Combined error from messages fetch or send
  const error = messagesError?.message || sendError;

  // Aggregate usage stats from messages
  const usage = useMemo(() => aggregateSessionUsage(messages), [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Check if user is near the bottom of the chat
  const checkIfNearBottom = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return true;

    const threshold = 100; // pixels from bottom
    const isNear =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;
    isNearBottomRef.current = isNear;
    return isNear;
  }, []);

  // Track scroll position to detect if user scrolled up
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkIfNearBottom();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [checkIfNearBottom]);

  // Auto-scroll when new messages appear, but only if user is near bottom
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      // New messages appeared
      if (isNearBottomRef.current) {
        setTimeout(() => {
          scrollToBottom();
        }, 50);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // Scroll to bottom on initial load after messages are fetched
  useEffect(() => {
    if (!hasScrolledInitially && !loading && messages.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom();
        setHasScrolledInitially(true);
        isNearBottomRef.current = true;
      }, 100);
    }
  }, [hasScrolledInitially, loading, messages.length, scrollToBottom]);

  // Reset scroll state when session changes
  useEffect(() => {
    setHasScrolledInitially(false);
    isNearBottomRef.current = true;
  }, [sessionId]);

  // Send a single message to the API
  const sendMessage = useCallback(
    async (messageText: string, messageId: string) => {
      if (!sessionId) return;

      try {
        const response = await fetch(`/api/sessions/${sessionId}/prompt`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: messageText,
            model: selectedModel,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        // Revalidate messages to get the response - SWR will fetch fresh data
        mutateSessionMessages(sessionId);
        // Ensure we scroll to see the response
        isNearBottomRef.current = true;

        // Refresh sessions list after response is received
        mutateSessions();
      } catch (err) {
        setSendError(
          err instanceof Error ? err.message : "Failed to send message",
        );
        // Remove the failed message from cache
        removeOptimisticMessage(sessionId, messageId);
      }
    },
    [sessionId, selectedModel],
  );

  // Process the message queue one by one
  const processQueue = useCallback(async () => {
    if (isProcessingQueue.current || !sessionId) return;

    isProcessingQueue.current = true;
    setSending(true);

    while (true) {
      // Get next message from queue
      let nextMessage: QueuedMessage | undefined;
      setMessageQueue((prev) => {
        if (prev.length === 0) {
          nextMessage = undefined;
          return prev;
        }
        nextMessage = prev[0];
        return prev.slice(1);
      });

      // Wait a tick for state to update
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (!nextMessage) break;

      // Mark message as no longer queued (now sending)
      updateOptimisticMessage(sessionId, nextMessage.id, { isQueued: false });

      await sendMessage(nextMessage.text, nextMessage.id);
    }

    isProcessingQueue.current = false;
    setSending(false);
  }, [sessionId, sendMessage]);

  // Process queue when messages are added
  useEffect(() => {
    if (messageQueue.length > 0 && !isProcessingQueue.current) {
      processQueue();
    }
  }, [messageQueue, processQueue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    const messageText = input.trim();
    const messageId = `temp-${Date.now()}`;
    setInput("");
    setSendError(null);

    // Determine if this message should be queued
    const shouldQueue = sending || messageQueue.length > 0;

    // Optimistically add user message to chat via SWR cache
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
    addOptimisticMessage(sessionId, optimisticMessage);

    // Add to queue
    setMessageQueue((prev) => [...prev, { id: messageId, text: messageText }]);

    // Ensure we scroll to see the new message
    isNearBottomRef.current = true;
    scrollToBottom();
  };

  return (
    <AppLayout>
      <div className="flex h-full flex-col">
        {/* Chat container - top part */}
        <div
          className="flex-1 overflow-auto overflow-x-hidden"
          ref={chatContainerRef}
        >
          {loading && (
            <div className="text-center text-muted-fg">Loading messages...</div>
          )}

          {error && (
            <div className="rounded-md bg-danger-subtle p-4 text-danger-subtle-fg">
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

          {/* Loading indicator when sending message */}
          {sending && (
            <div className="py-3 px-6">
              <div className="flex items-center gap-2">
                <Ripples size="30" speed="2" color="var(--color-primary)" />
                <span className="text-sm text-muted-fg">Thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Messaging UI - bottom part */}
        <div className="border-t border-border p-4 shrink-0 relative">
          <FileMentionPopover
            isOpen={fileMention.isOpen}
            searchQuery={fileMention.searchQuery}
            selectedIndex={fileMention.selectedIndex}
            onSelectedIndexChange={fileMention.setSelectedIndex}
            onFilesChange={setFileResults}
            textareaRef={textareaRef}
            mentionStart={fileMention.mentionStart}
            onClose={fileMention.close}
            onSelect={(filePath) => {
              const newValue = fileMention.handleSelect(filePath, input);
              setInput(newValue);
            }}
          />
          <form onSubmit={handleSubmit} className="w-full">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const value = e.target.value;
                setInput(value);
                // Only check for file mentions if @ is present or popover is already open
                if (fileMention.isOpen || value.includes("@")) {
                  // On mobile, selectionStart might be null or unreliable during onChange
                  // Use the end of the current value as fallback (cursor is usually at end after typing)
                  const cursorPos = e.target.selectionStart ?? value.length;
                  fileMention.handleInputChange(value, cursorPos);
                }
              }}
              onInput={(e) => {
                // onInput is more reliable on mobile for detecting @ symbol
                const target = e.target as HTMLTextAreaElement;
                const value = target.value;
                if (value.includes("@")) {
                  const cursorPos = target.selectionStart ?? value.length;
                  fileMention.handleInputChange(value, cursorPos);
                }
              }}
              onSelect={(e) => {
                // Also handle selection changes for mobile - this fires when cursor moves
                const target = e.target as HTMLTextAreaElement;
                if (fileMention.isOpen || input.includes("@")) {
                  const cursorPos = target.selectionStart ?? input.length;
                  fileMention.handleInputChange(input, cursorPos);
                }
              }}
              onKeyDown={(e) => {
                // Handle file mention keyboard navigation
                const handled = fileMention.handleKeyDown(
                  e,
                  fileResults.length,
                );
                if (handled) {
                  // If Enter/Tab was pressed and we have results, select the file
                  if (
                    (e.key === "Enter" || e.key === "Tab") &&
                    fileResults.length > 0
                  ) {
                    const selectedFile = fileResults[fileMention.selectedIndex];
                    if (selectedFile) {
                      const newValue = fileMention.handleSelect(
                        selectedFile,
                        input,
                      );
                      setInput(newValue);
                    }
                  }
                  return;
                }

                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) {
                    handleSubmit(e as unknown as React.FormEvent);
                  }
                }
              }}
              placeholder="Type your message... (use @ to mention files)"
              className="w-full resize-none min-h-32 max-h-32 overflow-y-auto"
              rows={5}
            />
            <div className="mt-3 flex items-center justify-between">
              {usage.totalTokens > 0 ? (
                <div className="text-xs text-muted-fg md:hidden">
                  <NumberFlow
                    value={usage.totalTokens}
                    format={{ notation: "compact" }}
                  />
                </div>
              ) : (
                <div className="md:hidden" />
              )}
              <div className="flex items-center gap-2 max-md:ml-auto">
                <ModelSelect />
                <Button
                  type="submit"
                  isDisabled={!input.trim()}
                  className="font-[family-name:var(--font-geist-mono)] uppercase min-w-32"
                >
                  <SendIcon size="16px" />
                  {sending ? "Sending..." : "Send"}
                </Button>
              </div>
              {usage.totalTokens > 0 && (
                <div className="text-xs text-muted-fg hidden md:block">
                  <NumberFlow
                    value={usage.totalTokens}
                    format={{ notation: "compact" }}
                  />{" "}
                  tokens
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
