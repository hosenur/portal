import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import AppLayout from "@/layouts/app-layout";
import { ModelSelect } from "@/components/model-select";
import { Textarea } from "@/components/ui/textarea";
import IconBadgeSparkle from "@/components/icons/badge-sparkle-icon";
import {
  FileMentionPopover,
  useFileMention,
} from "@/components/file-mention-popover";
import { Ripples } from "ldrs/react";
import "ldrs/react/Ripples.css";
import { Button } from "@/components/ui/button";

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
}

interface Session {
  id: string;
  title?: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  const fileMention = useFileMention();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Scroll once when user sends a message, then reset the flag
  useEffect(() => {
    if (shouldScrollOnce) {
      scrollToBottom();
      setShouldScrollOnce(false);
    }
  }, [shouldScrollOnce, scrollToBottom]);

  // Handle mobile keyboard - scroll input into view when focused
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleFocus = () => {
      // Small delay to wait for keyboard to appear
      setTimeout(() => {
        inputContainerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }, 300);
    };

    // Also handle resize events (keyboard appearing changes viewport)
    const handleResize = () => {
      if (document.activeElement === textarea) {
        inputContainerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    };

    textarea.addEventListener("focus", handleFocus);
    window.visualViewport?.addEventListener("resize", handleResize);

    return () => {
      textarea.removeEventListener("focus", handleFocus);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, []);

  const fetchMessages = async () => {
    if (!id) return;
    try {
      const messagesRes = await fetch(`/api/sessions/${id}/messages`);
      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        setMessages(messagesData.data || messagesData || []);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !id || sending) return;

    const messageText = input.trim();
    setInput("");
    setSending(true);

    // Trigger scroll once when sending
    setShouldScrollOnce(true);

    try {
      const response = await fetch(`/api/sessions/${id}/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: messageText }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      await fetchMessages();
      // Scroll once after receiving response
      setShouldScrollOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const getMessageContent = (parts: Part[]): string => {
    return parts
      .filter((part) => part.type === "text" && part.text?.trim())
      .map((part) => part.text || "")
      .join("\n\n");
  };

  const hasVisibleContent = (message: Message): boolean => {
    const textContent = getMessageContent(message.parts);
    const hasToolInvocations = message.parts.some(
      (part) => part.type === "tool-invocation",
    );
    const hasToolResults = message.parts.some(
      (part) => part.type === "tool-result",
    );
    return !!(textContent || hasToolInvocations || hasToolResults);
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
              .map((message) => {
                const textContent = getMessageContent(message.parts);
                return (
                  <div key={message.info.id} className="py-3 px-6">
                    <div className="mb-2 flex items-center gap-2">
                      {message.info.role === "assistant" && (
                        <IconBadgeSparkle size="16px" />
                      )}
                      {message.info.role === "user" && (
                        <span className="text-sm font-semibold">You</span>
                      )}
                      {message.info.createdAt && (
                        <span className="text-xs text-muted-fg">
                          {new Date(message.info.createdAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {textContent && (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {textContent}
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
              })}
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
        <div
          ref={inputContainerRef}
          className="border-t border-border p-4 shrink-0 relative"
        >
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
                const cursorPos = e.target.selectionStart;
                fileMention.handleInputChange(value, cursorPos);
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
                  if (input.trim() && !sending) {
                    handleSubmit(e as unknown as React.FormEvent);
                  }
                }
              }}
              placeholder="Type your message... (use @ to mention files)"
              disabled={sending}
              className="w-full resize-none min-h-32 max-h-32 overflow-y-auto"
              rows={5}
            />
            <div className="mt-3 flex items-center gap-2">
              <ModelSelect />
              <Button type="submit" isDisabled={sending || !input.trim()}>
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
