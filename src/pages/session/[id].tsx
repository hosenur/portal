import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useRouter } from "next/router";
import Markdown from "react-markdown";
import AppLayout from "@/layouts/app-layout";
import { ModelSelect } from "@/components/model-select";
import { Textarea } from "@/components/ui/textarea";
import IconBadgeSparkle from "@/components/icons/badge-sparkle-icon";
import IconUser from "@/components/icons/user-icon";
import {
  FileMentionPopover,
  useFileMention,
} from "@/components/file-mention-popover";
import { Ripples } from "ldrs/react";
import "ldrs/react/Ripples.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSelectedModel } from "@/hooks/use-selected-model";

interface Part {
  type: string;
  text?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

interface MessageInfo {
  id: string;
  role: "user" | "assistant";
  createdAt?: string;
}

interface Message {
  info: MessageInfo;
  parts: Part[];
  isQueued?: boolean;
}

interface QueuedMessage {
  id: string;
  text: string;
}

interface Session {
  id: string;
  title?: string;
}

function getMessageContent(parts: Part[]): string {
  return parts
    .filter((part) => part.type === "text" && part.text?.trim())
    .map((part) => part.text || "")
    .join("\n\n");
}

const MessageItem = memo(function MessageItem({
  message,
}: {
  message: Message;
}) {
  const textContent = getMessageContent(message.parts);
  const isAssistant = message.info.role === "assistant";

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
              className={`prose prose-sm dark:prose-invert max-w-none ${!isAssistant ? "text-muted-fg" : ""}`}
            >
              <Markdown>{textContent}</Markdown>
            </div>
          </div>
        </div>
      )}
      {message.parts
        .filter((part) => part.type === "tool-invocation")
        .map((part, idx) => (
          <div
            key={idx}
            className="mt-3 rounded border border-border bg-muted p-2 text-xs"
          >
            <div className="font-mono font-semibold text-primary">
              Tool: {part.toolName}
            </div>
            {part.args && (
              <pre className="mt-1 overflow-x-auto text-muted-fg">
                {JSON.stringify(part.args, null, 2)}
              </pre>
            )}
          </div>
        ))}
      {message.parts
        .filter((part) => part.type === "tool-result")
        .map((part, idx) => (
          <div
            key={idx}
            className="mt-2 rounded border border-success bg-success-subtle p-2 text-xs"
          >
            <div className="font-mono font-semibold text-success-subtle-fg">
              Result:
            </div>
            <pre className="mt-1 overflow-x-auto text-muted-fg">
              {typeof part.result === "string"
                ? part.result
                : JSON.stringify(part.result, null, 2)}
            </pre>
          </div>
        ))}
    </div>
  );
});

function hasVisibleContent(message: Message): boolean {
  const textContent = getMessageContent(message.parts);
  const hasToolInvocations = message.parts.some(
    (part) => part.type === "tool-invocation",
  );
  const hasToolResults = message.parts.some(
    (part) => part.type === "tool-result",
  );
  return !!(textContent || hasToolInvocations || hasToolResults);
}

export default function SessionPage() {
  const router = useRouter();
  const { id } = router.query;

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [fileResults, setFileResults] = useState<string[]>([]);
  const [shouldScrollOnce, setShouldScrollOnce] = useState(false);
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const isProcessingQueue = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fileMention = useFileMention();
  const { selectedModel } = useSelectedModel();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Scroll once when user sends a message, then reset the flag
  useEffect(() => {
    if (shouldScrollOnce) {
      // Small delay to ensure DOM is updated with new message
      setTimeout(() => {
        scrollToBottom();
        setShouldScrollOnce(false);
      }, 50);
    }
  }, [shouldScrollOnce, scrollToBottom]);

  // Scroll to bottom on initial load after messages are fetched
  useEffect(() => {
    if (!isInitialLoad && !loading && messages.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [isInitialLoad, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial data fetch
  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [sessionRes, messagesRes] = await Promise.all([
          fetch(`/api/sessions/${id}`),
          fetch(`/api/sessions/${id}/messages`),
        ]);

        if (!sessionRes.ok || !messagesRes.ok) {
          throw new Error("Failed to fetch session data");
        }

        const sessionData = await sessionRes.json();
        const messagesData = await messagesRes.json();

        setSession(sessionData.data || sessionData);
        setMessages(messagesData.data || messagesData || []);
        setIsInitialLoad(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  // Poll for new messages every 3 seconds (for cross-device sync)
  useEffect(() => {
    if (!id || loading) return;

    const pollInterval = setInterval(() => {
      // Don't poll while actively sending messages to avoid conflicts
      if (!isProcessingQueue.current) {
        fetchMessages();
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [id, loading]);

  const fetchMessages = async () => {
    if (!id) return;
    try {
      const messagesRes = await fetch(`/api/sessions/${id}/messages`);
      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        const fetchedMessages: Message[] =
          messagesData.data || messagesData || [];

        // Only preserve messages that are still queued (waiting to be sent)
        // Messages being sent (isQueued: false with temp ID) should be replaced by API response
        setMessages((prev) => {
          const stillQueuedMessages = prev.filter((m) => m.isQueued === true);
          // Merge: fetched messages + any still-queued messages
          return [...fetchedMessages, ...stillQueuedMessages];
        });
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  // Send a single message to the API
  const sendMessage = useCallback(
    async (messageText: string, messageId: string) => {
      try {
        const response = await fetch(`/api/sessions/${id}/prompt`, {
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

        await fetchMessages();
        setShouldScrollOnce(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
        // Remove the failed message from display
        setMessages((prev) => prev.filter((m) => m.info.id !== messageId));
      }
    },
    [id, selectedModel],
  );

  // Process the message queue one by one
  const processQueue = useCallback(async () => {
    if (isProcessingQueue.current || !id) return;

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
      setMessages((prev) =>
        prev.map((m) =>
          m.info.id === nextMessage!.id ? { ...m, isQueued: false } : m,
        ),
      );

      await sendMessage(nextMessage.text, nextMessage.id);
    }

    isProcessingQueue.current = false;
    setSending(false);
  }, [id, sendMessage]);

  // Process queue when messages are added
  useEffect(() => {
    if (messageQueue.length > 0 && !isProcessingQueue.current) {
      processQueue();
    }
  }, [messageQueue, processQueue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !id) return;

    const messageText = input.trim();
    const messageId = `temp-${Date.now()}`;
    setInput("");

    // Determine if this message should be queued
    const shouldQueue = sending || messageQueue.length > 0;

    // Optimistically add user message to chat
    const optimisticMessage: Message = {
      info: {
        id: messageId,
        role: "user",
        createdAt: new Date().toISOString(),
      },
      parts: [{ type: "text", text: messageText }],
      isQueued: shouldQueue,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    // Add to queue
    setMessageQueue((prev) => [...prev, { id: messageId, text: messageText }]);

    // Trigger scroll
    setShouldScrollOnce(true);
  };

  return (
    <AppLayout>
      <div className="flex h-full flex-col">
        {/* Chat container - top part */}
        <div className="flex-1 overflow-auto" ref={chatContainerRef}>
          {loading && (
            <div className="text-center text-muted-fg">Loading messages...</div>
          )}

          {error && (
            <div className="rounded-md bg-danger-subtle p-4 text-danger-subtle-fg">
              Error: {error}
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="text-center text-muted-fg">No messages found</div>
          )}

          <div className="divide-y divide-dashed divide-border">
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
                  const cursorPos = e.target.selectionStart;
                  fileMention.handleInputChange(value, cursorPos);
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
            <div className="mt-3 flex items-center gap-2">
              <ModelSelect />
              <Button type="submit" isDisabled={!input.trim()}>
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
