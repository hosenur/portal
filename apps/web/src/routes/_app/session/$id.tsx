import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
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
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  IconBadgeSparkle,
  IconEye,
  IconListChecks,
  IconMagnifier,
  IconPen,
  IconSquareFeather,
  IconUser,
  InformationCircleIcon,
  SendIcon,
  StopIcon,
  UndoIcon,
  IconEllipsisVertical,
  IconGitBranch,
} from "@/components/icons/lucide";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
  PopoverClose,
} from "@/components/ui/popover";
import { useAgentStore } from "@/stores/agent-store";
import { useDraftStore } from "@/stores/draft-store";
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
  useAbortSession,
  useForkSession,
  useRevertSession,
  useAgents,
  usePermissions,
  useQuestions,
  useSessionStatuses,
  useSessions,
} from "@/hooks/use-opencode";
import {
  getDefaultUserSelectableAgentName,
  isValidUserSelectableAgent,
} from "@/lib/agent-selection";
import { getErrorMessage, getResponseErrorMessage } from "@/lib/error-message";
import { formatTokens, formatCost } from "@/lib/format";
import { backendBasePath, type BackendProvider } from "@/lib/backend-url";
import type {
  Agent,
  Session,
  SessionMessage,
  SessionMessageAssistant,
} from "@opencode-ai/sdk/v2";

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
  return isValidUserSelectableAgent(agents, name);
}

function getDefaultSessionAgentName(agents: Agent[]) {
  return getDefaultUserSelectableAgentName(agents);
}

// formatTokens and formatCost imported from @/lib/format

function stripModelDateSuffix(modelId: string): string {
  return modelId.replace(/-\d{8}$/, "");
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

type QuestionAnswers = { chosen: string[]; typed: string[] };

/**
 * Parse the submitted answers from a completed question tool part.
 *
 * Answers can be stored in several shapes depending on the backend:
 *  - `state.metadata.answers` as string[][] indexed by question position
 *    (native opencode)
 *  - `state.input.answers` as a record keyed by question text ->
 *    string (single/custom) | string[] (multi) (Claude backend)
 *  - `state.input.answers` as string[][] indexed by question position (fallback)
 *
 * Returns one entry per question split into `chosen` (matches an option label)
 * and `typed` (freeform/custom answers that match no option). Returns null when
 * no answers are present (e.g. codex), so the caller can fall back to the
 * plain read-only list.
 */
function parseQuestionAnswers(
  part: ToolPart,
  questions: QuestionInfo[],
): QuestionAnswers[] | null {
  const state = (part.state || {}) as Record<string, unknown>;
  const metadata = (state.metadata || {}) as Record<string, unknown>;
  const input = (state.input || {}) as Record<string, unknown>;

  const rawMeta = metadata.answers;
  const rawInput = input.answers;

  const metaArray = Array.isArray(rawMeta) ? (rawMeta as unknown[]) : null;
  const inputArray = Array.isArray(rawInput) ? (rawInput as unknown[]) : null;
  const inputRecord =
    !inputArray && rawInput && typeof rawInput === "object"
      ? (rawInput as Record<string, unknown>)
      : null;

  if (!metaArray && !inputArray && !inputRecord) return null;

  const toStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value
        .map((v) => (typeof v === "string" ? v : String(v ?? "")))
        .filter((v) => v.length > 0);
    }
    if (typeof value === "string") {
      return value.length > 0 ? [value] : [];
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return [String(value)];
    }
    return [];
  };

  return questions.map((q, idx) => {
    let rawValue: unknown;
    if (metaArray) rawValue = metaArray[idx];
    else if (inputRecord) rawValue = inputRecord[q.question];
    else rawValue = inputArray?.[idx];

    const values = toStringArray(rawValue);
    const optionLabels = new Set(q.options.map((opt) => opt.label));
    const chosen: string[] = [];
    const typed: string[] = [];
    for (const value of values) {
      if (optionLabels.has(value)) chosen.push(value);
      else typed.push(value);
    }
    return { chosen, typed };
  });
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
    case "todowrite": {
      const todos = Array.isArray(input.todos) ? input.todos : [];
      const completed = todos.filter(
        (t: Record<string, unknown>) => t.status === "completed",
      ).length;
      const inProgress = todos.filter(
        (t: Record<string, unknown>) => t.status === "in_progress",
      ).length;
      const pending = todos.filter(
        (t: Record<string, unknown>) => t.status === "pending",
      ).length;
      const parts: string[] = [];
      if (completed) parts.push(`${completed} done`);
      if (inProgress) parts.push(`${inProgress} active`);
      if (pending) parts.push(`${pending} pending`);
      return {
        icon: <IconListChecks size="12px" />,
        label: `todos (${todos.length})`,
        details: parts.length ? parts.join(", ") : undefined,
      };
    }
    case "task":
    case "mcp_task": {
      const agent = String(input.subagent_type || "agent");
      const desc = String(input.description || "");
      return {
        icon: <IconBadgeSparkle size="12px" />,
        label: agent,
        details: desc || undefined,
      };
    }
    case "question":
    case "mcp_question": {
      const questions = Array.isArray(input.questions)
        ? input.questions
        : [];
      const count = questions.length;
      const firstHeader =
        count > 0 && typeof questions[0] === "object" && questions[0] !== null
          ? String(
              (questions[0] as Record<string, unknown>).header ||
                (questions[0] as Record<string, unknown>).question ||
                "",
            )
          : "";
      return {
        icon: "?",
        label: `question${count > 1 ? ` (${count})` : ""}`,
        details: firstHeader
          ? firstHeader.slice(0, 40) + (firstHeader.length > 40 ? "..." : "")
          : undefined,
      };
    }
    default: {
      const firstArg = Object.entries(input)[0];
      let detailStr: string | undefined;
      if (firstArg) {
        const val = firstArg[1];
        const valStr =
          typeof val === "object" && val !== null
            ? JSON.stringify(val)
            : String(val);
        detailStr = `${firstArg[0]}: ${valStr.slice(0, 30)}${valStr.length > 30 ? "..." : ""}`;
      }
      return {
        icon: "◼︎",
        label: toolName || "unknown",
        details: detailStr,
      };
    }
  }
}

function QuestionDisplay({
  questions,
  partKey,
  answers,
}: {
  questions: QuestionInfo[];
  partKey: string;
  answers?: QuestionAnswers[] | null;
}) {
  return (
    <>
      {questions.map((q, idx) => {
        const answer = answers?.[idx];
        const chosen = answer ? new Set(answer.chosen) : null;
        const typed = answer?.typed ?? [];
        const isAnswered = !!answer && (answer.chosen.length > 0 || typed.length > 0);

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

            {q.options.length > 0 &&
              (chosen ? (
                <div className="flex flex-wrap gap-1.5">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = chosen.has(opt.label);
                    return (
                      <span
                        key={`opt-${idx}-${optIdx}`}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 bg-bg text-muted-fg/60"
                        }`}
                      >
                        {isSelected && <CheckIcon size="12px" />}
                        <span>{opt.label}</span>
                        {opt.description && (
                          <span className="opacity-60"> - {opt.description}</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              ) : (
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
              ))}

            {typed.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wide text-muted-fg">
                  Your answer
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {typed.map((value, tIdx) => (
                    <span
                      key={`typed-${idx}-${tIdx}`}
                      className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2 py-1 text-xs text-primary"
                    >
                      <CheckIcon size="12px" />
                      <span>{value}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!isAnswered && (q.multiple || q.custom) && (
              <div className="text-[11px] text-muted-fg">
                {q.multiple && "You can select multiple options"}
                {q.multiple && q.custom && " | "}
                {q.custom && "Custom answer allowed"}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/**
 * Strip XML-like tool output tags that leak into assistant text content.
 * These come from compaction/synthetic messages that inline tool results.
 */
function sanitizeMessageText(text: string): string {
  let cleaned = text;

  // Strip tool output XML blocks: <path>...<type>...<content>...</content>
  cleaned = cleaned.replace(
    /<path>[\s\S]*?<\/path>\s*(?:<type>[\s\S]*?<\/type>\s*)?(?:<content>[\s\S]*?<\/content>)?/g,
    "",
  );

  // Strip standalone <content>...</content> or <type>...</type> blocks
  cleaned = cleaned.replace(/<content>[\s\S]*?<\/content>/g, "");
  cleaned = cleaned.replace(/<type>[^<]*<\/type>/g, "");

  // Strip system metadata tags
  cleaned = cleaned.replace(
    /<dcp-message-id>[\s\S]*?<\/dcp-message-id>/g,
    "",
  );
  cleaned = cleaned.replace(
    /<dcp-system-reminder>[\s\S]*?<\/dcp-system-reminder>/g,
    "",
  );
  cleaned = cleaned.replace(
    /<system-reminder>[\s\S]*?<\/system-reminder>/g,
    "",
  );
  cleaned = cleaned.replace(
    /<antml_thinking>[\s\S]*?<\/antml_thinking>/g,
    "",
  );

  // Strip "Called the X tool with the following input: {JSON}" lines
  // These are rendered separately as synthetic ToolCallItems
  cleaned = cleaned.replace(
    /(?:I\s+)?[Cc]alled\s+the\s+(\w+)\s+tool\s+with\s+the\s+following\s+input:\s*\{[\s\S]*?\}/g,
    "",
  );

  // Collapse excessive blank lines left after stripping
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

function getMessageContent(parts: Part[]): string {
  const raw = parts
    .filter(
      (part): part is Part & { type: "text"; text: string } =>
        part.type === "text" && "text" in part && !!part.text?.trim(),
    )
    .map((part) => part.text)
    .join("\n\n");

  return sanitizeMessageText(raw);
}

/**
 * Parse "Called the X tool with the following input: {JSON}" patterns
 * from raw text parts and return synthetic ToolPart objects so they
 * render as proper ToolCallItems (with icons, labels, etc.).
 */
function extractInlineToolCalls(parts: Part[]): ToolPart[] {
  const raw = parts
    .filter(
      (part): part is Part & { type: "text"; text: string } =>
        part.type === "text" && "text" in part && !!part.text?.trim(),
    )
    .map((part) => part.text)
    .join("\n\n");

  const pattern =
    /(?:I\s+)?[Cc]alled\s+the\s+(\w+)\s+tool\s+with\s+the\s+following\s+input:\s*(\{[\s\S]*?\})/g;
  const results: ToolPart[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const toolName = match[1]!;
    const jsonStr = match[2]!;
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, try to extract key fields with regex
      const fileMatch = jsonStr.match(/"(?:filePath|file)":\s*"([^"]+)"/);
      const cmdMatch = jsonStr.match(/"(?:command|cmd)":\s*"([^"]+)"/);
      const patternMatch = jsonStr.match(/"pattern":\s*"([^"]+)"/);
      if (fileMatch) input = { filePath: fileMatch[1] };
      else if (cmdMatch) input = { command: cmdMatch[1] };
      else if (patternMatch) input = { pattern: patternMatch[1] };
    }
    results.push({
      id: `synthetic-${toolName}-${results.length}`,
      sessionID: "",
      messageID: "",
      type: "tool",
      callID: `synthetic-${toolName}-${results.length}`,
      tool: toolName,
      state: {
        status: "completed",
        input,
        title: toolName,
        metadata: {},
        time: { start: 0, end: 0 },
      },
    } as ToolPart);
  }

  return results;
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
  provider,
  sessionId,
  callID,
  pendingQuestions,
  onResolved,
}: {
  questions: QuestionInfo[];
  partKey: string;
  port: number;
  provider?: BackendProvider;
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
      const apiBase = backendBasePath(provider, port);
      let match =
        pendingQuestions.find((q) => q.tool?.callID === callID) ??
        pendingQuestions.find((q) => q.sessionID === sessionId);

      if (!match) {
        const listRes = await fetch(`${apiBase}/questions`);
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

      const replyRes = await fetch(`${apiBase}/question/${match.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!replyRes.ok) throw new Error("Failed to submit answers");

      onResolved(match.id);
      mutateSessionMessages(port, sessionId, provider);
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
  provider,
  onResolved,
}: {
  permission: PermissionRequest;
  port: number;
  provider?: BackendProvider;
  onResolved: (requestId: string) => void;
}) {
  const [submitting, setSubmitting] = useState<PermissionReply | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleReply = async (reply: PermissionReply) => {
    setSubmitting(reply);
    setSubmitError(null);

    try {
      const apiBase = backendBasePath(provider, port);
      const response = await fetch(
        `${apiBase}/permission/${permission.id}/reply`,
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

const TodoItem = memo(function TodoItem({
  todo,
}: {
  todo: { content: string; status: string; priority?: string };
}) {
  const statusIcon =
    todo.status === "completed" ? (
      <CheckIcon size="11px" className="text-success" />
    ) : todo.status === "in_progress" ? (
      <span className="inline-block size-[11px] rounded-full border-2 border-warning animate-pulse" />
    ) : (
      <span className="inline-block size-[11px] rounded-full border-2 border-muted-fg/40" />
    );

  return (
    <div className="flex items-start gap-1.5 py-0.5">
      <span className="mt-px shrink-0">{statusIcon}</span>
      <span
        className={
          todo.status === "completed"
            ? "line-through opacity-50"
            : todo.status === "in_progress"
              ? "text-fg"
              : "opacity-70"
        }
      >
        {todo.content}
      </span>
    </div>
  );
});

const ToolCallItem = memo(function ToolCallItem({
  part,
  port,
  provider,
  sessionId,
  pendingQuestions,
  onQuestionResolved,
}: {
  part: ToolPart;
  port: number;
  provider?: BackendProvider;
  sessionId: string;
  pendingQuestions: QuestionRequest[];
  onQuestionResolved: (requestId: string) => void;
}) {
  const { icon, label, details } = formatToolCall(part);
  const toolName = (part.tool || "").toLowerCase();
  const isQuestionTool = toolName === "question";
  const isTodoTool = toolName === "todowrite";
  const isBashTool = toolName === "bash" || toolName === "mcp_bash";
  const isTaskTool = toolName === "task" || toolName === "mcp_task";
  const questions = isQuestionTool ? parseToolQuestions(part) : [];
  const hasQuestions = questions.length > 0;
  const isCompleted = part.state.status === "completed";
  const isError = part.state.status === "error";
  const isPending =
    part.state.status === "pending" || part.state.status === "running";
  const [todoExpanded, setTodoExpanded] = useState(false);
  const [bashExpanded, setBashExpanded] = useState(false);

  if (isTodoTool) {
    const input = (part.state?.input || {}) as Record<string, unknown>;
    const todos = Array.isArray(input.todos)
      ? (input.todos as { content: string; status: string; priority?: string }[])
      : [];

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
        <button
          type="button"
          onClick={() => setTodoExpanded((v) => !v)}
          className={`font-mono text-xs flex items-center gap-1.5 min-w-0 w-full text-left cursor-pointer ${
            isError
              ? "text-danger"
              : isCompleted
                ? "text-muted-fg"
                : isPending
                  ? "text-warning"
                  : "text-fg"
          }`}
        >
          <span className="opacity-60 shrink-0">
            {todoExpanded ? (
              <ChevronDownIcon size="12px" />
            ) : (
              <ChevronRightIcon size="12px" />
            )}
          </span>
          <span className="opacity-60 shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
          {details && <span className="opacity-60 shrink-0">{details}</span>}
          {isPending && <span className="animate-pulse shrink-0">...</span>}
        </button>

        {todoExpanded && todos.length > 0 && (
          <div className="mt-1.5 ml-1 space-y-0.5 font-mono text-xs">
            {todos.map((todo, i) => (
              <TodoItem key={i} todo={todo} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isTaskTool) {
    const state = part.state as Record<string, unknown>;
    const meta = (state.metadata || {}) as Record<string, unknown>;
    const subSessionId = typeof meta.sessionId === "string" ? meta.sessionId : "";

    const content = (
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

    if (subSessionId) {
      return (
        <Link
          to="/session/$id"
          params={{ id: subSessionId }}
          className="block hover:bg-muted/40 rounded-md -mx-1 px-1 transition-colors"
        >
          {content}
        </Link>
      );
    }

    return content;
  }

  if (isBashTool) {
    const state = part.state as Record<string, unknown>;
    const input = (state.input || {}) as Record<string, unknown>;
    const fullCommand = String(input.command || input.cmd || "");
    const output = typeof state.output === "string" ? state.output : "";
    const errorMsg = typeof state.error === "string" ? state.error : "";
    const hasContent = !!(fullCommand || output || errorMsg);

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
        <button
          type="button"
          onClick={() => hasContent && setBashExpanded((v) => !v)}
          className={`font-mono text-xs flex items-center gap-1.5 min-w-0 w-full text-left ${hasContent ? "cursor-pointer" : "cursor-default"} ${
            isError
              ? "text-danger"
              : isCompleted
                ? "text-muted-fg"
                : isPending
                  ? "text-warning"
                  : "text-fg"
          }`}
        >
          {hasContent && (
            <span className="opacity-60 shrink-0">
              {bashExpanded ? (
                <ChevronDownIcon size="12px" />
              ) : (
                <ChevronRightIcon size="12px" />
              )}
            </span>
          )}
          <span className="opacity-60 shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
          {details && <span className="opacity-60 shrink-0">{details}</span>}
          {isPending && <span className="animate-pulse shrink-0">...</span>}
        </button>

        {bashExpanded && (
          <div className="mt-2 space-y-2">
            {fullCommand && (
              <pre className="whitespace-pre-wrap break-all rounded bg-bg/80 p-2 text-[11px] leading-relaxed text-fg/90 border border-border/50 overflow-x-auto max-h-[300px] overflow-y-auto">
                <code>{fullCommand}</code>
              </pre>
            )}
            {output && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-fg/60 mb-1">output</div>
                <pre className="whitespace-pre-wrap break-all rounded bg-bg/80 p-2 text-[11px] leading-relaxed text-fg/70 border border-border/50 overflow-x-auto max-h-[400px] overflow-y-auto">
                  <code>{output}</code>
                </pre>
              </div>
            )}
            {errorMsg && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-danger/60 mb-1">error</div>
                <pre className="whitespace-pre-wrap break-all rounded bg-danger/5 p-2 text-[11px] leading-relaxed text-danger/80 border border-danger/30 overflow-x-auto max-h-[300px] overflow-y-auto">
                  <code>{errorMsg}</code>
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

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
            provider={provider}
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
              answers={parseQuestionAnswers(part, questions)}
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
  provider,
  sessionId,
  pendingPermissions,
  pendingQuestions,
  onPermissionResolved,
  onQuestionResolved,
  showActions,
  onFork,
  onRevert,
}: {
  message: MessageWithParts;
  port: number;
  provider?: BackendProvider;
  sessionId: string;
  pendingPermissions: PermissionRequest[];
  pendingQuestions: QuestionRequest[];
  onPermissionResolved: (requestId: string) => void;
  onQuestionResolved: (requestId: string) => void;
  showActions?: boolean;
  onFork?: (messageId: string, text: string) => void;
  onRevert?: (messageId: string) => void;
}) {
  const textContent = getMessageContent(message.parts);
  const isAssistant = message.info.role === "assistant";
  const messageError = isAssistant ? getAssistantError(message) : null;
  const realToolCalls = message.parts.filter(isToolPart);
  const inlineToolCalls = extractInlineToolCalls(message.parts);
  const toolCalls = [...inlineToolCalls, ...realToolCalls];
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
          <div className="flex-1 min-w-0">
            {!isAssistant && message.isQueued && (
              <Badge intent="warning" className="mb-1">
                Queued
              </Badge>
            )}
            <div
              className={`prose prose-sm dark:prose-invert max-w-none overflow-x-hidden ${!isAssistant ? "text-muted-fg" : ""}`}
            >
              {textContent && (
                <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{textContent}</Markdown>
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
          {!isAssistant && showActions && (
            <Menu>
              <MenuTrigger
                aria-label="Message actions"
                className="shrink-0 mt-1 p-0.5 rounded text-muted-fg hover:text-fg hover:bg-muted/60 transition-colors"
              >
                <IconEllipsisVertical size="14px" />
              </MenuTrigger>
              <MenuContent placement="bottom end">
                <MenuItem
                  onAction={() => onFork?.(message.info.id, textContent || "")}
                >
                  <IconGitBranch size="14px" className="mr-2" />
                  Fork
                </MenuItem>
                <MenuItem
                  onAction={() => onRevert?.(message.info.id)}
                >
                  <UndoIcon size="14px" className="mr-2" />
                  Revert
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
        </div>
      )}
      {toolCalls.length > 0 && (
        <div className={`${hasMainContent ? "mt-2 ml-6" : ""} space-y-0.5`}>
          {toolCalls.map((part) => (
            <ToolCallItem
              key={part.callID || part.id}
              part={part}
              port={port}
              provider={provider}
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
              provider={provider}
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
  const provider = instance?.provider;
  const supportsAgentSelection = provider === "opencode";
  const apiBase = port ? backendBasePath(provider, port) : "";

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
  const isSubagentSession = !!currentSession?.parentID;

  const subagentStats = useMemo(() => {
    if (!isSubagentSession) return null;
    let totalCost = 0;
    let lastContextTokens = 0;
    for (const msg of sessionMessages) {
      if (msg.type !== "assistant") continue;
      const am = msg as SessionMessageAssistant;
      totalCost += am.cost ?? 0;
      if (am.tokens) {
        const t = am.tokens;
        lastContextTokens =
          t.input + t.output + t.reasoning + t.cache.read + t.cache.write;
      }
    }
    const modelId = currentSession?.model?.id;
    const displayModel = modelId ? stripModelDateSuffix(modelId) : undefined;
    return { contextTokens: lastContextTokens, cost: totalCost, displayModel };
  }, [isSubagentSession, sessionMessages, currentSession?.model?.id]);

  useEffect(() => {
    if (currentSession?.title) {
      setPageTitle(currentSession.title);
    }
    return () => setPageTitle(null);
  }, [currentSession?.title, setPageTitle]);

  useEffect(() => {
    if (!supportsAgentSelection) return;
    if (!sessionId || agents.length === 0) return;
    if (isValidSessionAgent(agents, selectedAgent)) return;

    const fallback = getDefaultSessionAgentName(agents);
    if (fallback) {
      setSelectedAgent(sessionId, fallback);
    }
  }, [
    agents,
    sessionId,
    selectedAgent,
    setSelectedAgent,
    supportsAgentSelection,
  ]);

  const consumeDraft = useDraftStore((s) => s.consumeDraft);

  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasScrolledInitially, setHasScrolledInitially] = useState(false);
  const [fileResults, setFileResults] = useState<string[]>([]);

  useEffect(() => {
    const draft = consumeDraft(sessionId);
    if (draft) {
      setInput(draft);
    }
  }, [sessionId, consumeDraft]);

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

  const abortSession = useAbortSession();
  const handleAbort = useCallback(async () => {
    if (!sessionId) return;
    try {
      await abortSession(sessionId);
      mutateSessionMessages(port, sessionId, provider);
      mutateSessionStatuses();
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Failed to stop run",
      );
    }
  }, [sessionId, abortSession, port, provider, mutateSessionStatuses]);

  const navigate = useNavigate();
  const forkSession = useForkSession();
  const revertSession = useRevertSession();
  const setDraft = useDraftStore((s) => s.setDraft);

  const handleFork = useCallback(
    async (messageId: string, text: string) => {
      if (!sessionId) return;
      try {
        const newSession = await forkSession(sessionId, messageId);
        if (text) {
          setDraft(newSession.id, text);
        }
        mutateSessions();
        navigate({ to: "/session/$id", params: { id: newSession.id } });
      } catch (error) {
        setSendError(
          error instanceof Error ? error.message : "Failed to fork session",
        );
      }
    },
    [sessionId, forkSession, setDraft, mutateSessions, navigate],
  );

  const handleRevert = useCallback(
    async (messageId: string) => {
      if (!sessionId) return;
      try {
        await revertSession(sessionId, messageId);
        mutateSessionMessages(port, sessionId, provider);
        mutateSessions();
        mutateSessionStatuses();
      } catch (error) {
        setSendError(
          error instanceof Error ? error.message : "Failed to revert session",
        );
      }
    },
    [sessionId, revertSession, port, provider, mutateSessions, mutateSessionStatuses],
  );

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
        mutateSessionMessages(port, sessionId, provider);
      }
    },
    [port, provider, sessionId, mutatePermissions],
  );

  const handleQuestionResolved = useCallback(
    (requestId: string) => {
      void mutateQuestions(
        (current: QuestionRequest[] | undefined) =>
          (current ?? []).filter((question) => question.id !== requestId),
        { revalidate: false },
      );
      if (port && sessionId) {
        mutateSessionMessages(port, sessionId, provider);
      }
    },
    [port, provider, sessionId, mutateQuestions],
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
        let agentOverride: string | undefined;
        if (supportsAgentSelection) {
          const defaultAgent = isValidSessionAgent(
            agents,
            currentSession?.agent,
          )
            ? currentSession?.agent
            : getDefaultSessionAgentName(agents);
          agentOverride =
            selectedAgent && selectedAgent !== defaultAgent
              ? selectedAgent
              : undefined;
        }

        const response = await fetch(`${apiBase}/session/${sessionId}/prompt`, {
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
        });

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
            provider,
          );
        } else {
          settleOptimisticMessage(port, sessionId, messageId, provider);
        }

        isNearBottomRef.current = true;
        mutateSessionMessages(port, sessionId, provider);
        mutateSessionStatuses();
        mutateSessions();
      } catch (err) {
        setSendError(
          err instanceof Error ? err.message : "Failed to send message",
        );
        removeOptimisticMessage(port, sessionId, messageId, provider);
      }
    },
    [
      sessionId,
      port,
      provider,
      apiBase,
      currentSession?.agent,
      agents,
      selectedAgent,
      supportsAgentSelection,
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
    addOptimisticMessage(port, sessionId, optimisticMessage, provider);

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
      mutateSessionMessages(port, sessionId, provider);
    }, 1500);

    return () => window.clearInterval(interval);
  }, [port, provider, sending, sessionId]);

  return (
    <div className="flex h-[calc(100%+2rem)] flex-col -m-4">
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
                provider={provider}
                sessionId={sessionId}
                pendingPermissions={pendingPermissions}
                pendingQuestions={pendingQuestions}
                onPermissionResolved={handlePermissionResolved}
                onQuestionResolved={handleQuestionResolved}
                showActions={provider === "opencode"}
                onFork={handleFork}
                onRevert={handleRevert}
              />
            ))}
          {unlinkedPermissions.length > 0 && (
            <div className="px-6 py-4 space-y-2 border-t border-dashed border-border">
              {unlinkedPermissions.map((permission) => (
                <PermissionRequestForm
                  key={permission.id}
                  permission={permission}
                  port={port}
                  provider={provider}
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

      {isSubagentSession ? (
        <div className="border-t border-border px-4 py-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-fg font-mono">
              <IconBadgeSparkle size="14px" className="shrink-0" />
              <span>{currentSession?.agent || "subagent"}</span>
              {subagentStats?.displayModel && (
                <>
                  <span className="text-border">·</span>
                  <span>{subagentStats.displayModel}</span>
                </>
              )}
              {(subagentStats?.contextTokens ?? 0) > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span>{formatTokens(subagentStats!.contextTokens)} ctx</span>
                </>
              )}
              {(subagentStats?.cost ?? 0) > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span>{formatCost(subagentStats!.cost)}</span>
                </>
              )}
            </div>
            <Link
              to="/session/$id"
              params={{ id: currentSession!.parentID! }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-fg hover:bg-muted/60 transition-colors"
            >
              <ArrowLeftIcon size="12px" />
              Parent
            </Link>
          </div>
        </div>
      ) : (
      <div className="border-t border-border px-4 pt-4 pb-4 shrink-0 relative">
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
          <div className="relative">
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
                const handled = fileMention.handleKeyDown(
                  e,
                  fileResults.length,
                );
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
              className="min-h-32 max-h-32 w-full resize-none overflow-y-auto pr-14 pb-12"
              rows={5}
            />
            {sending ? (
              <Popover isOpen={confirmStopOpen} onOpenChange={setConfirmStopOpen}>
                <Button
                  type="button"
                  isCircle
                  size="sq-sm"
                  aria-label="Stop run"
                  className="absolute right-3 bottom-3"
                >
                  <span className="grid size-4 place-items-center">
                    <StopIcon size="14px" className="fill-current" />
                  </span>
                </Button>
                <PopoverContent
                  placement="top end"
                  className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-0"
                >
                  <div className="flex flex-col gap-4 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/12 text-danger">
                        <StopIcon size="16px" className="fill-current" />
                      </span>
                      <div className="space-y-1 pt-0.5">
                        <PopoverTitle className="font-semibold text-fg text-sm/5">
                          Stop this run?
                        </PopoverTitle>
                        <PopoverDescription className="text-muted-fg text-xs/5">
                          This cancels the current run. Any in-progress work will
                          be aborted.
                        </PopoverDescription>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <PopoverClose
                        size="sm"
                        className="border-transparent bg-transparent text-muted-fg [background:transparent] [box-shadow:none] [--btn-shadow-ring:transparent] hover:text-fg hover:[background:color-mix(in_oklab,var(--color-fg)_8%,transparent)] pressed:[background:color-mix(in_oklab,var(--color-fg)_12%,transparent)]"
                      >
                        Keep running
                      </PopoverClose>
                      <Button
                        size="sm"
                        onPress={() => {
                          setConfirmStopOpen(false);
                          void handleAbort();
                        }}
                        className="border-transparent text-danger-fg [background:var(--color-danger)] [box-shadow:none] [--btn-shadow-ring:transparent] hover:[background:color-mix(in_oklab,var(--color-danger)_90%,black_10%)] pressed:[background:color-mix(in_oklab,var(--color-danger)_82%,black_18%)]"
                      >
                        Stop run
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                type="submit"
                isDisabled={!input.trim()}
                isCircle
                size="sq-sm"
                aria-label="Send message"
                className="absolute right-3 bottom-3"
              >
                <span className="grid size-4 place-items-center">
                  <SendIcon size="16px" />
                </span>
              </Button>
            )}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            {supportsAgentSelection && <AgentSelect sessionId={sessionId} />}
            <ModelSelect />
          </div>
        </form>
      </div>
      )}
    </div>
  );
}
