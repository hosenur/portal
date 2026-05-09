import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Ripples } from "ldrs/react";
import "ldrs/react/Ripples.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/ui/loader";
import { AgentSelect } from "@/components/agent-select";
import { ModelSelect } from "@/components/model-select";
import {
  FileMentionPopover,
  useFileMention,
} from "@/components/file-mention-popover";
import {
  IconBadgeSparkle,
  IconEye,
  IconMagnifier,
  IconPen,
  IconSquareFeather,
  IconUser,
  InformationCircleIcon,
  SendIcon,
} from "@/components/icons/lucide";
import { useAgentStore } from "@/stores/agent-store";
import { useInstanceStore } from "@/stores/instance-store";
import { useModelStore } from "@/stores/model-store";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import {
  useSessionMessages,
  addOptimisticMessage,
  reconcileOptimisticMessage,
  settleOptimisticMessage,
  removeOptimisticMessage,
  mutateSessionMessages,
  type MessageWithParts,
  type Part,
  type ToolPart,
  type PermissionRequest,
  type QuestionAnswer,
  type QuestionInfo,
  type QuestionRequest,
} from "@/hooks/use-session-messages";
import {
  useAgents,
  usePermissions,
  useQuestions,
  useSessionStatuses,
  useSessions,
} from "@/hooks/use-opencode";
import { getErrorMessage, getResponseErrorMessage } from "@/lib/error-message";
import type { Agent, Session, SessionMessage } from "@opencode-ai/sdk/v2";

export const Route = createFileRoute("/_app/session/$id")({
  component: SessionPage,
});

type PermissionReply = "once" | "always" | "reject";

interface PromptSendResponse {
  accepted: boolean;
  duplicate?: boolean;
  mode?: "v2" | "legacy";
  message?: SessionMessage;
  messageID?: string;
}

function isValidSessionAgent(agents: Agent[], name?: string) {
  if (!name) return false;
  return agents.some((agent) => agent.name === name);
}

function getDefaultSessionAgentName(agents: Agent[]) {
  return agents.find((agent) => agent.name === "plan")?.name ?? agents[0]?.name;
}

const OPENCODE_ID_LENGTH = 26;
let lastMessageIdTimestamp = 0;
let messageIdCounter = 0;

function getRandomBytes(length: number) {
  const bytes = new Uint8Array(length);
  const cryptoObj =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    cryptoObj.getRandomValues(bytes);
    return bytes;
  }

  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function randomBase62(length: number) {
  const chars =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const bytes = getRandomBytes(length);
  let result = "";

  for (let i = 0; i < length; i += 1) {
    result += chars[bytes[i] % chars.length];
  }

  return result;
}

function createClientMessageId() {
  const currentTimestamp = Date.now();

  if (currentTimestamp !== lastMessageIdTimestamp) {
    lastMessageIdTimestamp = currentTimestamp;
    messageIdCounter = 0;
  }

  messageIdCounter += 1;

  const encoded =
    BigInt(currentTimestamp) * BigInt(0x1000) + BigInt(messageIdCounter);
  const timeBytes = new Uint8Array(6);

  for (let i = 0; i < timeBytes.length; i += 1) {
    timeBytes[i] = Number((encoded >> BigInt(40 - 8 * i)) & BigInt(0xff));
  }

  const timeHex = Array.from(timeBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `msg_${timeHex}${randomBase62(OPENCODE_ID_LENGTH - timeHex.length)}`;
}

function isToolPart(part: Part): part is ToolPart {
  return part.type === "tool";
}

function parseToolQuestions(part: ToolPart): QuestionInfo[] {
  const input = (part.state?.input || {}) as Record<string, unknown>;
  const rawQuestions = input.questions;

  if (!Array.isArray(rawQuestions)) {
    return [];
  }

  return rawQuestions
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => ({
      question: String(item.question || ""),
      header: String(item.header || ""),
      options: Array.isArray(item.options)
        ? item.options
            .filter(
              (opt): opt is Record<string, unknown> =>
                typeof opt === "object" && opt !== null,
            )
            .map((opt) => ({
              label: String(opt.label || ""),
              description: String(opt.description || ""),
            }))
            .filter((opt) => !!opt.label)
        : [],
      multiple: Boolean(item.multiple),
      custom: item.custom !== false,
    }))
    .filter((q) => !!q.question);
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

function QuestionDisplay({
  questions,
  partKey,
}: {
  questions: QuestionInfo[];
  partKey: string;
}) {
  return (
    <>
      {questions.map((q, idx) => (
        <div key={`${partKey}-q-${idx}`} className="space-y-1">
          {(q.header || q.multiple) && (
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-fg">
              {q.header && <span>{q.header}</span>}
              {q.multiple && (
                <span className="rounded border border-warning/50 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                  Multi-select
                </span>
              )}
            </div>
          )}
          <p className="text-xs leading-relaxed">{q.question}</p>

          {q.options.length > 0 && (
            <ul className="space-y-1 ml-3 list-disc text-muted-fg">
              {q.options.map((opt, optIdx) => (
                <li key={`opt-${idx}-${optIdx}`}>
                  <span className="text-fg">{opt.label}</span>
                  {opt.description && (
                    <span className="text-muted-fg"> - {opt.description}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {(q.multiple || q.custom) && (
            <div className="text-[11px] text-muted-fg">
              {q.multiple && "You can select multiple options"}
              {q.multiple && q.custom && " | "}
              {q.custom && "Custom answer allowed"}
            </div>
          )}
        </div>
      ))}
    </>
  );
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

function getAssistantError(message: MessageWithParts) {
  return "error" in message.info ? getErrorMessage(message.info.error) : null;
}

function ChatErrorAlert({
  title,
  message,
  className = "",
}: {
  title: string;
  message: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-md border border-danger/20 bg-danger-subtle px-3 py-2 text-danger-subtle-fg ${className}`}
    >
      <div className="flex items-start gap-2">
        <InformationCircleIcon size="14px" className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-0.5 break-words text-xs opacity-90">{message}</div>
        </div>
      </div>
    </div>
  );
}

function QuestionAnswerForm({
  questions,
  partKey,
  port,
  sessionId,
  callID,
  pendingQuestions,
  onResolved,
}: {
  questions: QuestionInfo[];
  partKey: string;
  port: number;
  sessionId: string;
  callID: string;
  pendingQuestions: QuestionRequest[];
  onResolved: (requestId: string) => void;
}) {
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [freeformInputs, setFreeformInputs] = useState<Record<number, string>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleOption = (qIdx: number, label: string, isMulti: boolean) => {
    setSelections((prev) => {
      const current = prev[qIdx] || [];
      if (isMulti) {
        return {
          ...prev,
          [qIdx]: current.includes(label)
            ? current.filter((l) => l !== label)
            : [...current, label],
        };
      }
      return { ...prev, [qIdx]: current.includes(label) ? [] : [label] };
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      let match =
        pendingQuestions.find((q) => q.tool?.callID === callID) ??
        pendingQuestions.find((q) => q.sessionID === sessionId);

      if (!match) {
        const listRes = await fetch(`/api/opencode/${port}/questions`);
        if (!listRes.ok) throw new Error("Failed to fetch pending questions");
        const latestQuestions = (await listRes.json()) as QuestionRequest[];
        match =
          latestQuestions.find((q) => q.tool?.callID === callID) ??
          latestQuestions.find((q) => q.sessionID === sessionId);
      }

      if (!match) {
        throw new Error(
          "Question request not found - it may have already been answered",
        );
      }

      // Build answers array: one string[] per question
      const answers: QuestionAnswer[] = questions.map((_, i) => {
        const selected = selections[i] || [];
        const freeform = freeformInputs[i]?.trim() || "";
        if (selected.length > 0) return selected;
        if (freeform) return [freeform];
        return [];
      });

      const replyRes = await fetch(
        `/api/opencode/${port}/question/${match.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        },
      );

      if (!replyRes.ok) throw new Error("Failed to submit answers");

      onResolved(match.id);
      mutateSessionMessages(port, sessionId);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit answers",
      );
      setSubmitting(false);
    }
  };

  const hasAnswersForAllQuestions =
    questions.length > 0 &&
    questions.every((_, i) => {
      const selected = selections[i] || [];
      const freeform = freeformInputs[i]?.trim() || "";
      return selected.length > 0 || freeform.length > 0;
    });

  return (
    <div className="mt-2 space-y-3 text-fg/90">
      {questions.map((q, idx) => {
        const selected = selections[idx] || [];

        return (
          <div key={`${partKey}-q-${idx}`} className="space-y-1.5">
            {(q.header || q.multiple) && (
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-fg">
                {q.header && <span>{q.header}</span>}
                {q.multiple && (
                  <span className="rounded border border-warning/50 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    Multi-select
                  </span>
                )}
              </div>
            )}
            <p className="text-xs leading-relaxed">{q.question}</p>

            {q.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt, optIdx) => {
                  const isSelected = selected.includes(opt.label);
                  return (
                    <button
                      key={`opt-${idx}-${optIdx}`}
                      type="button"
                      disabled={submitting}
                      onClick={() => toggleOption(idx, opt.label, !!q.multiple)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-bg hover:border-fg/30 text-fg/80"
                      } ${submitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span>{opt.label}</span>
                      {opt.description && (
                        <span className="opacity-60"> - {opt.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {(q.options.length === 0 || q.custom) && (
              <input
                type="text"
                disabled={submitting}
                placeholder="Type your answer..."
                value={freeformInputs[idx] || ""}
                onChange={(e) =>
                  setFreeformInputs((prev) => ({
                    ...prev,
                    [idx]: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-border bg-bg px-2 py-1 text-xs text-fg placeholder:text-muted-fg focus:outline-none focus:border-primary"
              />
            )}

            {q.multiple && (
              <div className="text-[11px] text-warning/90">
                You can select more than one option
              </div>
            )}
          </div>
        );
      })}

      {submitError && (
        <div className="text-[11px] text-danger">{submitError}</div>
      )}

      <Button
        type="button"
        size="sm"
        isDisabled={!hasAnswersForAllQuestions || submitting}
        onPress={handleSubmit}
        className="mt-1"
      >
        <SendIcon size="12px" />
        {submitting ? "Sending..." : "Submit Answers"}
      </Button>
    </div>
  );
}

function PermissionRequestForm({
  permission,
  port,
  onResolved,
}: {
  permission: PermissionRequest;
  port: number;
  onResolved: (requestId: string) => void;
}) {
  const [submitting, setSubmitting] = useState<PermissionReply | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleReply = async (reply: PermissionReply) => {
    setSubmitting(reply);
    setSubmitError(null);

    try {
      const response = await fetch(
        `/api/opencode/${port}/permission/${permission.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to reply to permission request");
      }

      onResolved(permission.id);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to reply to permission",
      );
      setSubmitting(null);
    }
  };

  const firstPattern = permission.patterns[0];

  return (
    <div className="mt-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs space-y-2">
      <div className="font-medium text-warning">Permission required</div>
      <div className="text-fg/90">
        Tool requests <span className="font-mono">{permission.permission}</span>
      </div>
      {firstPattern && (
        <div className="text-muted-fg break-all">
          Path: <span className="font-mono">{firstPattern}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <Button
          type="button"
          size="sm"
          isDisabled={!!submitting}
          onPress={() => handleReply("once")}
        >
          {submitting === "once" ? "Allowing..." : "Allow once"}
        </Button>
        <Button
          type="button"
          size="sm"
          isDisabled={!!submitting}
          onPress={() => handleReply("always")}
          className="bg-success/20 text-success hover:bg-success/25"
        >
          {submitting === "always" ? "Saving..." : "Allow always"}
        </Button>
        <Button
          type="button"
          size="sm"
          isDisabled={!!submitting}
          onPress={() => handleReply("reject")}
          className="bg-danger/20 text-danger hover:bg-danger/25"
        >
          {submitting === "reject" ? "Rejecting..." : "Reject"}
        </Button>
      </div>
      {submitError && <div className="text-danger">{submitError}</div>}
    </div>
  );
}

const ToolCallItem = memo(function ToolCallItem({
  part,
  port,
  sessionId,
  pendingQuestions,
  onQuestionResolved,
}: {
  part: ToolPart;
  port: number;
  sessionId: string;
  pendingQuestions: QuestionRequest[];
  onQuestionResolved: (requestId: string) => void;
}) {
  const { icon, label, details } = formatToolCall(part);
  const isQuestionTool = (part.tool || "").toLowerCase() === "question";
  const questions = isQuestionTool ? parseToolQuestions(part) : [];
  const hasQuestions = questions.length > 0;
  const isCompleted = part.state.status === "completed";
  const isError = part.state.status === "error";
  const isPending =
    part.state.status === "pending" || part.state.status === "running";

  if (hasQuestions) {
    return (
      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          isError
            ? "border-danger/40 bg-danger-subtle/30"
            : isCompleted
              ? "border-border bg-muted/25"
              : "border-warning/40 bg-warning/10"
        }`}
      >
        <div className="font-mono text-xs flex items-center gap-1.5 min-w-0">
          <span className="opacity-60 shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
          {details && <span className="opacity-60 shrink-0">{details}</span>}
          {isPending && <span className="animate-pulse shrink-0">...</span>}
        </div>

        {isPending && port ? (
          <QuestionAnswerForm
            questions={questions}
            partKey={part.callID || part.id}
            port={port}
            sessionId={sessionId}
            callID={part.callID || ""}
            pendingQuestions={pendingQuestions}
            onResolved={onQuestionResolved}
          />
        ) : (
          <div className="mt-2 space-y-2 text-fg/90">
            <QuestionDisplay
              questions={questions}
              partKey={part.callID || part.id}
            />
          </div>
        )}
      </div>
    );
  }

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
  port,
  sessionId,
  pendingPermissions,
  pendingQuestions,
  onPermissionResolved,
  onQuestionResolved,
}: {
  message: MessageWithParts;
  port: number;
  sessionId: string;
  pendingPermissions: PermissionRequest[];
  pendingQuestions: QuestionRequest[];
  onPermissionResolved: (requestId: string) => void;
  onQuestionResolved: (requestId: string) => void;
}) {
  const textContent = getMessageContent(message.parts);
  const isAssistant = message.info.role === "assistant";
  const messageError = isAssistant ? getAssistantError(message) : null;
  const toolCalls = message.parts.filter(isToolPart);
  const messagePermissions = pendingPermissions.filter(
    (perm) => perm.tool?.messageID === message.info.id,
  );
  const hasMainContent = !!(textContent || messageError);

  return (
    <div className="py-3 px-6">
      {hasMainContent && (
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
              {textContent && (
                <Markdown remarkPlugins={[remarkGfm]}>{textContent}</Markdown>
              )}
            </div>
            {messageError && (
              <ChatErrorAlert
                title="Message failed"
                message={messageError}
                className={textContent ? "mt-2" : ""}
              />
            )}
          </div>
        </div>
      )}
      {toolCalls.length > 0 && (
        <div className={`${hasMainContent ? "mt-2 ml-6" : ""} space-y-0.5`}>
          {toolCalls.map((part) => (
            <ToolCallItem
              key={part.callID || part.id}
              part={part}
              port={port}
              sessionId={sessionId}
              pendingQuestions={pendingQuestions}
              onQuestionResolved={onQuestionResolved}
            />
          ))}
        </div>
      )}
      {messagePermissions.length > 0 && (
        <div className={`${hasMainContent ? "mt-2 ml-6" : ""} space-y-2`}>
          {messagePermissions.map((permission) => (
            <PermissionRequestForm
              key={permission.id}
              permission={permission}
              port={port}
              onResolved={onPermissionResolved}
            />
          ))}
        </div>
      )}
    </div>
  );
});

function hasVisibleContent(message: MessageWithParts): boolean {
  const textContent = getMessageContent(message.parts);
  const hasToolCalls = message.parts.some(isToolPart);
  const messageError =
    message.info.role === "assistant" ? getAssistantError(message) : null;
  return !!(textContent || hasToolCalls || messageError);
}

function SessionPage() {
  const { id: sessionId } = Route.useParams();
  const instance = useInstanceStore((s) => s.instance);
  const port = instance?.port ?? 0;

  const {
    messages,
    sessionMessages,
    isLoading: loading,
    error: messagesError,
  } = useSessionMessages(sessionId);
  const { data: sessionsData, mutate: mutateSessions } = useSessions();
  const { data: agentsData } = useAgents();
  const { data: sessionStatusesData, mutate: mutateSessionStatuses } =
    useSessionStatuses();
  const { data: permissionsData, mutate: mutatePermissions } = usePermissions();
  const { data: questionsData, mutate: mutateQuestions } = useQuestions();
  const selectedModel = useModelStore((s) => s.selectedModel);
  const selectedAgent = useAgentStore((s) => s.getSelectedAgent(sessionId));
  const setSelectedAgent = useAgentStore((s) => s.setSelectedAgent);
  const { setPageTitle } = useBreadcrumb();

  const sessions: Session[] = sessionsData ?? [];
  const agents: Agent[] = agentsData ?? [];
  const currentSession = sessions.find((s) => s.id === sessionId);

  useEffect(() => {
    if (currentSession?.title) {
      setPageTitle(currentSession.title);
    }
    return () => setPageTitle(null);
  }, [currentSession?.title, setPageTitle]);

  useEffect(() => {
    if (!sessionId || agents.length === 0) return;
    if (isValidSessionAgent(agents, selectedAgent)) return;

    const fallback = getDefaultSessionAgentName(agents);
    if (fallback) {
      setSelectedAgent(sessionId, fallback);
    }
  }, [agents, sessionId, selectedAgent, setSelectedAgent]);

  const [sendError, setSendError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasScrolledInitially, setHasScrolledInitially] = useState(false);
  const [fileResults, setFileResults] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submitLockRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const fileMention = useFileMention();

  const messagesLoadError = messagesError?.message;

  const sessionStatus = sessionId
    ? sessionStatusesData?.[sessionId]
    : undefined;
  const sending = useMemo(() => {
    const statusActive =
      sessionStatus?.type === "busy" || sessionStatus?.type === "retry";
    const hasOpenAssistant = sessionMessages.some(
      (message) =>
        message.type === "assistant" &&
        message.time.completed === undefined &&
        message.content.length > 0,
    );
    const hasPendingUser = sessionMessages.some(
      (message) =>
        message.type === "user" && message.metadata?.portalPending === true,
    );

    return isSubmitting || statusActive || hasOpenAssistant || hasPendingUser;
  }, [isSubmitting, sessionMessages, sessionStatus?.type]);

  const pendingPermissions = useMemo(
    () =>
      ((permissionsData ?? []) as PermissionRequest[]).filter(
        (item) => item.sessionID === sessionId,
      ),
    [permissionsData, sessionId],
  );

  const pendingQuestions = useMemo(
    () =>
      ((questionsData ?? []) as QuestionRequest[]).filter(
        (item) => item.sessionID === sessionId,
      ),
    [questionsData, sessionId],
  );

  const handlePermissionResolved = useCallback(
    (requestId: string) => {
      void mutatePermissions(
        (current: PermissionRequest[] | undefined) =>
          (current ?? []).filter((permission) => permission.id !== requestId),
        { revalidate: false },
      );
      if (port && sessionId) {
        mutateSessionMessages(port, sessionId);
      }
    },
    [port, sessionId, mutatePermissions],
  );

  const handleQuestionResolved = useCallback(
    (requestId: string) => {
      void mutateQuestions(
        (current: QuestionRequest[] | undefined) =>
          (current ?? []).filter((question) => question.id !== requestId),
        { revalidate: false },
      );
      if (port && sessionId) {
        mutateSessionMessages(port, sessionId);
      }
    },
    [port, sessionId, mutateQuestions],
  );

  const visibleMessageIds = useMemo(
    () => new Set(messages.map((m) => m.info.id)),
    [messages],
  );
  const unlinkedPermissions = pendingPermissions.filter(
    (perm) =>
      !perm.tool?.messageID || !visibleMessageIds.has(perm.tool.messageID),
  );

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
        const defaultAgent =
          currentSession?.agent ?? getDefaultSessionAgentName(agents);
        const agentOverride =
          selectedAgent && selectedAgent !== defaultAgent
            ? selectedAgent
            : undefined;

        const response = await fetch(
          `/api/opencode/${port}/session/${sessionId}/prompt`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messageID: messageId,
              text: messageText,
              model:
                selectedModel.providerID && selectedModel.modelID
                  ? selectedModel
                  : undefined,
              agent: agentOverride,
            }),
          },
        );

        if (!response.ok) {
          const fallback = `Failed to send message (${response.status}${
            response.statusText ? ` ${response.statusText}` : ""
          })`;
          throw new Error(await getResponseErrorMessage(response, fallback));
        }

        const result = (await response.json()) as PromptSendResponse;
        if (result.message?.id) {
          reconcileOptimisticMessage(
            port,
            sessionId,
            messageId,
            result.message,
          );
        } else {
          settleOptimisticMessage(port, sessionId, messageId);
        }

        isNearBottomRef.current = true;
        mutateSessionMessages(port, sessionId);
        mutateSessionStatuses();
        mutateSessions();
      } catch (err) {
        setSendError(
          err instanceof Error ? err.message : "Failed to send message",
        );
        removeOptimisticMessage(port, sessionId, messageId);
      }
    },
    [
      sessionId,
      port,
      currentSession?.agent,
      agents,
      selectedAgent,
      selectedModel,
      mutateSessionStatuses,
      mutateSessions,
    ],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = input.trim();
    if (
      !messageText ||
      !sessionId ||
      !port ||
      sending ||
      submitLockRef.current
    ) {
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    const messageId = createClientMessageId();
    setInput("");
    setSendError(null);

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
      isQueued: sending,
    };
    addOptimisticMessage(port, sessionId, optimisticMessage);

    void sendMessage(messageText, messageId).finally(() => {
      submitLockRef.current = false;
      setIsSubmitting(false);
    });

    isNearBottomRef.current = true;
    scrollToBottom();
  };

  useEffect(() => {
    submitLockRef.current = false;
    setIsSubmitting(false);
  }, [port, sessionId]);

  useEffect(() => {
    if (!sending || !port || !sessionId) return;

    const interval = window.setInterval(() => {
      mutateSessionMessages(port, sessionId);
    }, 1500);

    return () => window.clearInterval(interval);
  }, [port, sending, sessionId]);

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

        {messagesLoadError && (
          <div className="rounded-md bg-danger-subtle p-4 m-4 text-danger-subtle-fg">
            Error: {messagesLoadError}
          </div>
        )}

        {!loading && !messagesLoadError && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-fg">No messages yet</div>
          </div>
        )}

        <div className="divide-y divide-dashed divide-border overflow-x-hidden">
          {messages
            .filter((message) => hasVisibleContent(message))
            .map((message) => (
              <MessageItem
                key={message.info.id}
                message={message}
                port={port}
                sessionId={sessionId}
                pendingPermissions={pendingPermissions}
                pendingQuestions={pendingQuestions}
                onPermissionResolved={handlePermissionResolved}
                onQuestionResolved={handleQuestionResolved}
              />
            ))}
          {unlinkedPermissions.length > 0 && (
            <div className="px-6 py-4 space-y-2 border-t border-dashed border-border">
              {unlinkedPermissions.map((permission) => (
                <PermissionRequestForm
                  key={permission.id}
                  permission={permission}
                  port={port}
                  onResolved={handlePermissionResolved}
                />
              ))}
            </div>
          )}
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

      <div className="border-t border-border p-4 shrink-0 relative">
        <FileMentionPopover
          isOpen={fileMention.isOpen}
          searchQuery={fileMention.searchQuery}
          textareaRef={textareaRef}
          mentionStart={fileMention.mentionStart}
          selectedIndex={fileMention.selectedIndex}
          onSelectedIndexChange={fileMention.setSelectedIndex}
          onFilesChange={setFileResults}
          onClose={fileMention.close}
          onSelect={(filePath) => {
            const newValue = fileMention.handleSelect(filePath, input);
            setInput(newValue);
          }}
        />
        <form onSubmit={handleSubmit} className="w-full">
          {sendError && (
            <ChatErrorAlert
              title="Message failed"
              message={sendError}
              className="mb-3"
            />
          )}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              const value = e.target.value;
              setInput(value);
              if (fileMention.isOpen || value.includes("@")) {
                const cursorPos = e.target.selectionStart ?? value.length;
                fileMention.handleInputChange(value, cursorPos);
              }
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              const value = target.value;
              if (value.includes("@")) {
                const cursorPos = target.selectionStart ?? value.length;
                fileMention.handleInputChange(value, cursorPos);
              }
            }}
            onSelect={(e) => {
              const target = e.target as HTMLTextAreaElement;
              if (fileMention.isOpen || input.includes("@")) {
                const cursorPos = target.selectionStart ?? input.length;
                fileMention.handleInputChange(input, cursorPos);
              }
            }}
            onKeyDown={(e) => {
              const handled = fileMention.handleKeyDown(e, fileResults.length);
              if (handled) {
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
                if (input.trim() && !sending && !submitLockRef.current) {
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }
            }}
            placeholder="Type your message... (use @ to mention files)"
            className="w-full resize-none min-h-32 max-h-32 overflow-y-auto"
            rows={5}
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <AgentSelect sessionId={sessionId} />
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <ModelSelect />
              <Button
                type="submit"
                isDisabled={!input.trim() || sending}
                className="min-w-32"
              >
                <SendIcon size="16px" />
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
