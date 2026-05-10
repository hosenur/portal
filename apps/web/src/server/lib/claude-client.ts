import { execFile } from "child_process";
import { existsSync, readFileSync } from "fs";
import { randomUUID } from "crypto";
import { homedir } from "os";
import { basename, join, resolve } from "path";
import { promisify } from "util";
import {
  query as claudeQuery,
  type CanUseTool,
  type PermissionResult,
  type Query,
  type SDKAssistantMessage,
  type SDKMessage,
  type SDKPartialAssistantMessage,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  Session,
  SessionMessage,
  SessionMessageAssistant,
  SessionMessageAssistantTool,
  SessionStatus,
} from "@opencode-ai/sdk/v2";

const CONFIG_PATH = join(homedir(), ".portal.json");
const COMMAND_TIMEOUT_MS = 2_500;
const DEFAULT_MODEL_ID = "claude-sonnet-4-6";
const CLAUDE_MODELS = [
  { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
  { id: "claude-opus-4-5", name: "Claude Opus 4.5" },
  { id: DEFAULT_MODEL_ID, name: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
];

const execFileAsync = promisify(execFile);

type Provider = "opencode" | "codex" | "claude";
type CanUseToolOptions = Parameters<CanUseTool>[2];

interface PortalInstance {
  id: string;
  name: string;
  directory: string;
  provider?: Provider;
  backendPort?: number;
  opencodePort: number;
  hostname?: string;
  claudeBinaryPath?: string;
  claudeHomePath?: string;
  claudeLaunchArgs?: string;
}

export interface PortalEvent {
  id: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface PendingPermission {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  message?: string;
  tool?: {
    callID: string;
    messageID: string;
  };
}

export interface PendingQuestion {
  id: string;
  sessionID: string;
  tool?: {
    callID: string;
  };
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiple: boolean;
    custom: boolean;
  }>;
}

interface PendingPermissionWaiter {
  permission: PendingPermission;
  suggestions?: CanUseToolOptions["suggestions"];
  resolve: (result: PermissionResult) => void;
}

interface PendingQuestionWaiter {
  question: PendingQuestion;
  rawQuestions: unknown;
  resolve: (result: PermissionResult) => void;
}

interface ClaudeSession {
  id: string;
  title: string;
  directory: string;
  createdAt: number;
  updatedAt: number;
  modelID: string;
  status: SessionStatus;
  messages: SessionMessage[];
  query: Query | null;
  abortController: AbortController | null;
  claudeSessionId?: string;
  queue: Promise<void>;
}

interface PromptInput {
  messageID?: string;
  text: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  agent?: string;
}

interface StreamBlockRef {
  kind: "text" | "reasoning" | "tool";
  contentIndex: number;
  toolInput?: string;
}

function readConfig(): PortalInstance[] {
  try {
    if (!existsSync(CONFIG_PATH)) return [];
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return Array.isArray(config.instances) ? config.instances : [];
  } catch {
    return [];
  }
}

function getClaudeInstance(port: number): PortalInstance | null {
  return (
    readConfig().find(
      (instance) =>
        instance.provider === "claude" &&
        (instance.backendPort ?? instance.opencodePort) === port,
    ) ?? null
  );
}

function directoryName(directory: string): string {
  const normalized = directory.replace(/\\+/g, "/").replace(/\/+$/g, "");
  return basename(normalized) || directory;
}

function nowEventId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function expandHomePath(path: string) {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function parseLaunchArgs(value: string | undefined) {
  const args = value?.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const extraArgs: Record<string, string | null> = {};

  for (let index = 0; index < args.length; index += 1) {
    const raw = args[index].replace(/^"|"$/g, "");
    if (!raw.startsWith("--")) continue;

    const [key, inlineValue] = raw.slice(2).split("=", 2);
    if (!key) continue;

    if (inlineValue !== undefined) {
      extraArgs[key] = inlineValue;
      continue;
    }

    const next = args[index + 1]?.replace(/^"|"$/g, "");
    if (next && !next.startsWith("--")) {
      extraArgs[key] = next;
      index += 1;
    } else {
      extraArgs[key] = null;
    }
  }

  return extraArgs;
}

function emptyTokens() {
  return {
    input: 0,
    output: 0,
    reasoning: 0,
    cache: {
      read: 0,
      write: 0,
    },
  };
}

function usageTokens(usage: unknown) {
  if (!isRecord(usage)) return emptyTokens();

  const input =
    Number(usage.input_tokens) ||
    Number(usage.cache_creation_input_tokens) ||
    0;
  const output = Number(usage.output_tokens) || 0;
  const reasoning =
    Number(usage.reasoning_output_tokens) ||
    Number(usage.thinking_output_tokens) ||
    0;
  const cacheRead = Number(usage.cache_read_input_tokens) || 0;
  const cacheWrite = Number(usage.cache_creation_input_tokens) || 0;

  return {
    input,
    output,
    reasoning,
    cache: {
      read: cacheRead,
      write: cacheWrite,
    },
  };
}

function userMessage(id: string, text: string, created = Date.now()) {
  return {
    id,
    type: "user",
    text,
    time: { created },
  } satisfies SessionMessage;
}

function assistantMessage(input: {
  id: string;
  modelID: string;
  content?: SessionMessageAssistant["content"];
  created?: number;
  completed?: number;
  error?: string;
  cost?: number;
  tokens?: ReturnType<typeof emptyTokens>;
}) {
  return {
    id: input.id,
    type: "assistant",
    agent: "claude",
    model: {
      id: input.modelID,
      providerID: "anthropic",
      variant: "default",
    },
    content: input.content ?? [],
    time: {
      created: input.created ?? Date.now(),
      ...(input.completed ? { completed: input.completed } : {}),
    },
    tokens: input.tokens ?? emptyTokens(),
    ...(typeof input.cost === "number" ? { cost: input.cost } : {}),
    ...(input.error
      ? {
          finish: "error" as const,
          error: {
            type: "unknown" as const,
            message: input.error,
          },
        }
      : {}),
  } satisfies SessionMessageAssistant;
}

function sortMessages(messages: SessionMessage[]) {
  return messages
    .map((message, index) => ({ message, index }))
    .sort(
      (a, b) => {
        const timeDiff = a.message.time.created - b.message.time.created;
        if (timeDiff !== 0) return timeDiff;
        if (a.message.type === "user" && b.message.type === "assistant") {
          return -1;
        }
        if (a.message.type === "assistant" && b.message.type === "user") {
          return 1;
        }
        return a.index - b.index;
      },
    )
    .map((item) => item.message);
}

function upsertMessage(messages: SessionMessage[], message: SessionMessage) {
  const next = [...messages];
  const index = next.findIndex((item) => item.id === message.id);
  if (index >= 0) {
    next[index] = message;
  } else {
    next.push(message);
  }
  return sortMessages(next);
}

function messageTimestamp(message: SessionMessage) {
  const completed =
    "completed" in message.time ? (message.time.completed ?? 0) : 0;
  return Math.max(message.time.created, completed);
}

function nextSessionTimestamp(session: ClaudeSession, minimum = Date.now()) {
  const latestMessageTime = session.messages.reduce(
    (latest, message) => Math.max(latest, messageTimestamp(message)),
    session.createdAt,
  );
  return Math.max(minimum, latestMessageTime + 1);
}

function blockText(block: Record<string, unknown>) {
  return (
    extractText(block.text) ||
    extractText(block.thinking) ||
    extractText(block.summary)
  );
}

function blockInput(block: Record<string, unknown>) {
  return isRecord(block.input) ? block.input : {};
}

function toolContent(
  block: Record<string, unknown>,
  index: number,
): SessionMessageAssistantTool {
  const id = extractText(block.id) || `claude-tool-${index}`;
  const name =
    extractText(block.name) || extractText(block.tool_name) || "tool";
  const input = blockInput(block);

  return {
    type: "tool",
    id,
    name,
    provider: {
      executed: true,
      metadata: {
        provider: "claude",
      },
    },
    time: {
      created: Date.now(),
      ran: Date.now(),
      completed: Date.now(),
    },
    state: {
      status: "completed",
      input,
      structured: {},
      content: [],
    },
  };
}

function sdkAssistantContent(
  message: SDKAssistantMessage,
): SessionMessageAssistant["content"] {
  const blocks = Array.isArray(message.message.content)
    ? message.message.content
    : [];
  const content: SessionMessageAssistant["content"] = [];

  blocks.forEach((block, index) => {
    if (!isRecord(block)) return;

    if (block.type === "text") {
      const text = blockText(block);
      if (text) content.push({ type: "text", text });
      return;
    }

    if (block.type === "thinking" || block.type === "redacted_thinking") {
      const text = blockText(block);
      if (text) {
        content.push({
          type: "reasoning",
          id: extractText(block.signature) || `claude-reasoning-${index}`,
          text,
        });
      }
      return;
    }

    if (
      block.type === "tool_use" ||
      block.type === "server_tool_use" ||
      block.type === "mcp_tool_use"
    ) {
      content.push(toolContent(block, index));
    }
  });

  return content;
}

function sessionToInfo(session: ClaudeSession): Session {
  return {
    id: session.id,
    slug: session.id,
    projectID: "claude",
    directory: session.directory,
    title: session.title,
    agent: "claude",
    time: {
      created: session.createdAt,
      updated: session.updatedAt,
    },
    model: {
      providerID: "anthropic",
      id: session.modelID,
    },
    version: "claude",
  };
}

function promptTitle(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function getMessageText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : String(error || fallback);
}

function questionList(input: Record<string, unknown>): PendingQuestion["questions"] {
  const rawQuestions = Array.isArray(input.questions) ? input.questions : [];

  return rawQuestions.filter(isRecord).map((question, index) => ({
    question: extractText(question.question),
    header: extractText(question.header) || `Question ${index + 1}`,
    options: Array.isArray(question.options)
      ? question.options.filter(isRecord).map((option) => ({
          label: extractText(option.label),
          description: extractText(option.description),
        }))
      : [],
    multiple: question.multiSelect === true,
    custom: true,
  }));
}

function questionAnswers(
  question: PendingQuestion,
  answers: string[][],
): Record<string, unknown> {
  return Object.fromEntries(
    question.questions.map((item, index) => {
      const selected = answers[index] ?? [];
      return [item.question, item.multiple ? selected : selected[0] ?? ""];
    }),
  );
}

async function commandOutput(
  command: string,
  args: string[],
  cwd?: string,
): Promise<string> {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
      timeout: COMMAND_TIMEOUT_MS,
    });
    return String(result.stdout).trim();
  } catch {
    return "";
  }
}

class ClaudeAppClient {
  private sessions = new Map<string, ClaudeSession>();
  private eventListeners = new Set<(event: PortalEvent) => void>();
  private pendingPermissions = new Map<string, PendingPermissionWaiter>();
  private pendingQuestions = new Map<string, PendingQuestionWaiter>();

  constructor(private readonly port: number) {}

  get instance() {
    return getClaudeInstance(this.port);
  }

  get directory() {
    return this.instance?.directory ?? process.cwd();
  }

  get binaryPath() {
    return this.instance?.claudeBinaryPath?.trim() || "claude";
  }

  get homePath() {
    return this.instance?.claudeHomePath?.trim() || "";
  }

  get launchArgs() {
    return this.instance?.claudeLaunchArgs?.trim() || "";
  }

  subscribe(listener: (event: PortalEvent) => void) {
    this.eventListeners.add(listener);
    queueMicrotask(() => {
      if (!this.eventListeners.has(listener)) return;
      listener({
        id: nowEventId("claude-connected"),
        type: "server.connected",
        properties: {},
      });
    });

    return () => {
      this.eventListeners.delete(listener);
    };
  }

  emit(type: string, properties: Record<string, unknown>, id?: string) {
    const event = {
      id: id ?? nowEventId(`claude-${type.replace(/\W+/g, "-")}`),
      type,
      properties,
    };

    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  createSession(title?: string) {
    const now = Date.now();
    const id = randomUUID();
    const session: ClaudeSession = {
      id,
      title: title?.trim() || "New Claude session",
      directory: this.directory,
      createdAt: now,
      updatedAt: now,
      modelID: DEFAULT_MODEL_ID,
      status: { type: "idle" },
      messages: [],
      query: null,
      abortController: null,
      queue: Promise.resolve(),
    };

    this.sessions.set(id, session);
    this.emit("session.created", { info: sessionToInfo(session) });
    this.emit("session.status", { sessionID: id, status: session.status });
    return sessionToInfo(session);
  }

  listSessions() {
    return [...this.sessions.values()]
      .map(sessionToInfo)
      .sort(
        (a, b) =>
          (b.time.updated ?? b.time.created) -
          (a.time.updated ?? a.time.created),
      );
  }

  getSession(id: string) {
    return sessionToInfo(this.requireSession(id));
  }

  deleteSession(id: string) {
    const session = this.requireSession(id);
    void session.query?.interrupt().catch(() => {});
    session.query?.close();
    session.abortController?.abort();
    this.sessions.delete(id);
    this.emit("session.deleted", { sessionID: id });
    return { id };
  }

  getMessages(id: string) {
    return this.requireSession(id).messages;
  }

  getStatuses() {
    return Object.fromEntries(
      [...this.sessions.values()].map((session) => [session.id, session.status]),
    );
  }

  getPendingPermissions() {
    return [...this.pendingPermissions.values()].map((item) => item.permission);
  }

  getPendingQuestions() {
    return [...this.pendingQuestions.values()].map((item) => item.question);
  }

  async replyPermission(
    requestId: string,
    reply: "once" | "always" | "reject",
  ) {
    const pending = this.pendingPermissions.get(requestId);
    if (!pending) return;

    this.pendingPermissions.delete(requestId);
    this.emit("permission.replied", { requestID: requestId });

    if (reply === "reject") {
      pending.resolve({
        behavior: "deny",
        message: "Denied by user.",
      });
      return;
    }

    pending.resolve({
      behavior: "allow",
      ...(reply === "always" && pending.suggestions
        ? { updatedPermissions: pending.suggestions }
        : {}),
    });
  }

  async replyQuestion(requestId: string, answers: string[][]) {
    const pending = this.pendingQuestions.get(requestId);
    if (!pending) return;

    this.pendingQuestions.delete(requestId);
    this.emit("question.replied", { requestID: requestId });
    pending.resolve({
      behavior: "allow",
      updatedInput: {
        questions: pending.rawQuestions,
        answers: questionAnswers(pending.question, answers),
      },
    });
  }

  async rejectQuestion(requestId: string) {
    const pending = this.pendingQuestions.get(requestId);
    if (!pending) return;

    this.pendingQuestions.delete(requestId);
    this.emit("question.rejected", { requestID: requestId });
    pending.resolve({
      behavior: "deny",
      message: "Question rejected by user.",
    });
  }

  prompt(sessionId: string, input: PromptInput) {
    const session = this.requireSession(sessionId);
    const user = userMessage(
      input.messageID ?? randomUUID(),
      input.text,
      nextSessionTimestamp(session),
    );

    session.modelID = input.model?.modelID || session.modelID || DEFAULT_MODEL_ID;
    session.updatedAt = user.time.created;
    if (session.title === "New Claude session") {
      session.title = promptTitle(input.text) || session.title;
      this.emit("session.updated", { info: sessionToInfo(session) });
    }

    session.messages = upsertMessage(session.messages, user);
    this.emit("session.next.prompted", {
      sessionID: session.id,
      timestamp: user.time.created,
      prompt: { text: input.text, files: [], agents: [] },
    }, user.id);
    this.emit("message.updated", { sessionID: session.id });

    session.queue = session.queue
      .catch(() => {})
      .then(() => this.runTurn(session, input));

    return user;
  }

  async abort(sessionId: string) {
    const session = this.requireSession(sessionId);
    if (!session.query && !session.abortController) {
      throw new Error("No active Claude turn to abort");
    }

    session.abortController?.abort();
    await session.query?.interrupt();
    session.query?.close();
    this.finishTurn(session, "interrupted");
    return { id: sessionId };
  }

  getProject() {
    return {
      name: directoryName(this.directory),
      worktree: this.directory,
    };
  }

  async getHealth() {
    return {
      healthy: true,
      version: (await this.getVersion()) || "claude",
    };
  }

  async getVersion() {
    const output = await commandOutput(this.binaryPath, ["--version"]);
    return output || null;
  }

  async getConfig() {
    return {
      provider: "claude",
      directory: this.directory,
      binaryPath: this.binaryPath,
      homePath: this.homePath,
      launchArgs: this.launchArgs,
    };
  }

  getProviders() {
    return {
      providers: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: Object.fromEntries(
            CLAUDE_MODELS.map((model) => [
              model.id,
              {
                id: model.id,
                name: model.name,
                providerID: "anthropic",
              },
            ]),
          ),
        },
      ],
      default: {
        anthropic: DEFAULT_MODEL_ID,
      },
    };
  }

  async getGitDiff() {
    const diff = await commandOutput("git", ["diff", "--no-ext-diff"], this.directory);
    return {
      diff,
      worktree: this.directory,
    };
  }

  async searchFiles(query: string) {
    if (!query) return { data: [] };

    const output = await commandOutput("rg", ["--files"], this.directory);
    const needle = query.toLowerCase();
    return {
      data: output
        .split("\n")
        .filter((file) => file.toLowerCase().includes(needle))
        .slice(0, 100),
    };
  }

  private requireSession(id: string) {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Claude session not found: ${id}`);
    }
    return session;
  }

  private async runTurn(session: ClaudeSession, input: PromptInput) {
    const assistantId = randomUUID();
    const created = nextSessionTimestamp(session);
    const blockRefs = new Map<number, StreamBlockRef>();
    session.status = { type: "busy" };
    session.updatedAt = created;
    session.messages = upsertMessage(
      session.messages,
      assistantMessage({
        id: assistantId,
        modelID: session.modelID,
        created,
      }),
    );

    this.emit("session.status", {
      sessionID: session.id,
      status: session.status,
    });
    this.emit("message.updated", { sessionID: session.id });

    const abortController = new AbortController();
    session.abortController = abortController;

    try {
      const q = claudeQuery({
        prompt: input.text,
        options: {
          cwd: this.directory,
          ...(input.model?.modelID ? { model: input.model.modelID } : {}),
          ...(input.agent ? { agent: input.agent } : {}),
          ...(session.claudeSessionId
            ? { resume: session.claudeSessionId }
            : { sessionId: session.id }),
          pathToClaudeCodeExecutable: this.binaryPath,
          systemPrompt: { type: "preset", preset: "claude_code" },
          settingSources: ["user", "project", "local"],
          includePartialMessages: true,
          abortController,
          permissionMode: "acceptEdits",
          canUseTool: (toolName, toolInput, options) =>
            this.canUseTool(session, toolName, toolInput, options),
          env: this.claudeEnv(),
          additionalDirectories: [this.directory],
          extraArgs: parseLaunchArgs(this.launchArgs),
          stderr: () => {},
        },
      });
      session.query = q;

      for await (const message of q) {
        this.handleSdkMessage(session, assistantId, message, blockRefs);
      }

      this.finishTurn(session, "completed");
    } catch (error) {
      const message = getMessageText(error, "Claude turn failed.");
      this.replaceAssistant(session, assistantId, (assistant) => ({
        ...assistant,
        time: {
          ...assistant.time,
          completed: nextSessionTimestamp(session),
        },
        finish: "error",
        error: {
          type: "unknown",
          message,
        },
      }));
      this.emit("session.error", {
        sessionID: session.id,
        error: {
          type: "unknown",
          message,
        },
      });
      this.finishTurn(session, "error");
    } finally {
      session.query = null;
      session.abortController = null;
      for (const [id, pending] of this.pendingPermissions) {
        if (pending.permission.sessionID !== session.id) continue;
        this.pendingPermissions.delete(id);
        this.emit("permission.replied", { requestID: id });
      }
      for (const [id, pending] of this.pendingQuestions) {
        if (pending.question.sessionID !== session.id) continue;
        this.pendingQuestions.delete(id);
        this.emit("question.rejected", { requestID: id });
      }
    }
  }

  private finishTurn(session: ClaudeSession, status: "completed" | "error" | "interrupted") {
    const now = nextSessionTimestamp(session);
    session.status = { type: "idle" };
    session.updatedAt = now;

    if (status === "interrupted") {
      this.replaceActiveAssistant(session, (assistant) => ({
        ...assistant,
        time: {
          ...assistant.time,
          completed: now,
        },
        finish: "abort",
      }));
    } else {
      this.replaceActiveAssistant(session, (assistant) => ({
        ...assistant,
        time: {
          ...assistant.time,
          completed: assistant.time.completed ?? now,
        },
      }));
    }

    this.emit("session.updated", { info: sessionToInfo(session) });
    this.emit("session.idle", { sessionID: session.id });
    this.emit("message.updated", { sessionID: session.id });
  }

  private handleSdkMessage(
    session: ClaudeSession,
    assistantId: string,
    message: SDKMessage,
    blockRefs: Map<number, StreamBlockRef>,
  ) {
    if ("session_id" in message && typeof message.session_id === "string") {
      session.claudeSessionId = message.session_id;
    }

    if (message.type === "stream_event") {
      this.handleStreamEvent(session, assistantId, message, blockRefs);
      return;
    }

    if (message.type === "assistant") {
      this.replaceAssistant(session, assistantId, (assistant) => ({
        ...assistant,
        content: sdkAssistantContent(message),
      }));
      this.emit("message.updated", { sessionID: session.id });
      return;
    }

    if (message.type === "result") {
      this.handleResult(session, assistantId, message);
      return;
    }

    if (message.type === "system" && message.subtype === "local_command_output") {
      this.replaceAssistant(session, assistantId, (assistant) => ({
        ...assistant,
        content: [
          ...assistant.content,
          { type: "text", text: message.content },
        ],
      }));
      this.emit("message.updated", { sessionID: session.id });
    }
  }

  private handleResult(
    session: ClaudeSession,
    assistantId: string,
    result: SDKResultMessage,
  ) {
    this.replaceAssistant(session, assistantId, (assistant) => {
      const resultText =
        result.subtype === "success" && result.result && assistant.content.length === 0
          ? [{ type: "text" as const, text: result.result }]
          : assistant.content;

      return {
        ...assistant,
        content: resultText,
        time: {
          ...assistant.time,
          completed: nextSessionTimestamp(session),
        },
        cost: result.total_cost_usd,
        tokens: usageTokens(result.usage),
        finish: result.subtype === "success" ? "stop" : "error",
        ...(result.subtype !== "success"
          ? {
              error: {
                type: "unknown" as const,
                message: result.errors?.join("\n") || "Claude turn failed.",
              },
            }
          : {}),
      };
    });
    this.emit("message.updated", { sessionID: session.id });
  }

  private handleStreamEvent(
    session: ClaudeSession,
    assistantId: string,
    message: SDKPartialAssistantMessage,
    blockRefs: Map<number, StreamBlockRef>,
  ) {
    const event = message.event;
    if (!isRecord(event)) return;

    if (event.type === "content_block_start") {
      const index = Number(event.index);
      const block: Record<string, unknown> = isRecord(event.content_block)
        ? event.content_block
        : {};
      this.replaceAssistant(session, assistantId, (assistant) => {
        const content = [...assistant.content];
        if (block.type === "text") {
          blockRefs.set(index, {
            kind: "text",
            contentIndex: content.length,
          });
          content.push({ type: "text", text: blockText(block) });
        } else if (block.type === "thinking") {
          blockRefs.set(index, {
            kind: "reasoning",
            contentIndex: content.length,
          });
          content.push({
            type: "reasoning",
            id: extractText(block.signature) || `claude-reasoning-${index}`,
            text: blockText(block),
          });
        } else if (
          block.type === "tool_use" ||
          block.type === "server_tool_use" ||
          block.type === "mcp_tool_use"
        ) {
          blockRefs.set(index, {
            kind: "tool",
            contentIndex: content.length,
            toolInput: "",
          });
          content.push({
            ...toolContent(block, index),
            state: {
              status: "pending",
              input: JSON.stringify(blockInput(block)),
            },
          });
        }
        return { ...assistant, content };
      });
      this.emit("message.part.delta", { sessionID: session.id });
      return;
    }

    if (event.type !== "content_block_delta") return;

    const index = Number(event.index);
    const ref = blockRefs.get(index);
    if (!ref) return;
    const delta: Record<string, unknown> = isRecord(event.delta)
      ? event.delta
      : {};

    this.replaceAssistant(session, assistantId, (assistant) => {
      const content = [...assistant.content];
      const item = content[ref.contentIndex];
      if (!item) return assistant;

      if (ref.kind === "text" && item.type === "text") {
        content[ref.contentIndex] = {
          ...item,
          text: `${item.text}${extractText(delta.text)}`,
        };
      } else if (ref.kind === "reasoning" && item.type === "reasoning") {
        content[ref.contentIndex] = {
          ...item,
          text: `${item.text}${extractText(delta.thinking) || extractText(delta.text)}`,
        };
      } else if (ref.kind === "tool" && item.type === "tool") {
        ref.toolInput = `${ref.toolInput ?? ""}${extractText(delta.partial_json)}`;
        content[ref.contentIndex] = {
          ...item,
          state: {
            status: "pending",
            input: ref.toolInput,
          },
        };
      }

      return { ...assistant, content };
    });
    this.emit("message.part.delta", { sessionID: session.id });
  }

  private replaceAssistant(
    session: ClaudeSession,
    assistantId: string,
    updater: (assistant: SessionMessageAssistant) => SessionMessageAssistant,
  ) {
    session.messages = session.messages.map((message) => {
      if (message.id !== assistantId || message.type !== "assistant") {
        return message;
      }
      return updater(message);
    });
  }

  private replaceActiveAssistant(
    session: ClaudeSession,
    updater: (assistant: SessionMessageAssistant) => SessionMessageAssistant,
  ) {
    const index = [...session.messages]
      .reverse()
      .findIndex((message) => message.type === "assistant" && !message.time.completed);
    if (index < 0) return;

    const forwardIndex = session.messages.length - 1 - index;
    const message = session.messages[forwardIndex];
    if (message.type !== "assistant") return;

    const next = [...session.messages];
    next[forwardIndex] = updater(message);
    session.messages = next;
  }

  private canUseTool(
    session: ClaudeSession,
    toolName: string,
    toolInput: Record<string, unknown>,
    options: CanUseToolOptions,
  ): Promise<PermissionResult> {
    if (toolName === "AskUserQuestion") {
      return this.askQuestion(session, toolInput, options);
    }

    const requestId = randomUUID();
    const permission: PendingPermission = {
      id: requestId,
      sessionID: session.id,
      permission: toolName,
      patterns: [],
      message:
        options.title ||
        options.description ||
        `${options.displayName || toolName} needs approval.`,
      tool: {
        callID: options.toolUseID,
        messageID: options.toolUseID,
      },
    };

    this.emit("permission.asked", { ...permission });
    return new Promise<PermissionResult>((resolve) => {
      const abort = () => {
        this.pendingPermissions.delete(requestId);
        this.emit("permission.replied", { requestID: requestId });
        resolve({
          behavior: "deny",
          message: "Permission request was aborted.",
        });
      };

      if (options.signal.aborted) {
        abort();
        return;
      }

      options.signal.addEventListener("abort", abort, { once: true });
      this.pendingPermissions.set(requestId, {
        permission,
        suggestions: options.suggestions,
        resolve,
      });
    });
  }

  private askQuestion(
    session: ClaudeSession,
    toolInput: Record<string, unknown>,
    options: CanUseToolOptions,
  ): Promise<PermissionResult> {
    const requestId = randomUUID();
    const question: PendingQuestion = {
      id: requestId,
      sessionID: session.id,
      tool: {
        callID: options.toolUseID,
      },
      questions: questionList(toolInput),
    };

    this.emit("question.asked", { ...question });
    return new Promise<PermissionResult>((resolve) => {
      const abort = () => {
        this.pendingQuestions.delete(requestId);
        this.emit("question.rejected", { requestID: requestId });
        resolve({
          behavior: "deny",
          message: "Question request was aborted.",
        });
      };

      if (options.signal.aborted) {
        abort();
        return;
      }

      options.signal.addEventListener("abort", abort, { once: true });
      this.pendingQuestions.set(requestId, {
        question,
        rawQuestions: toolInput.questions,
        resolve,
      });
    });
  }

  private claudeEnv() {
    if (!this.homePath) return process.env;

    return {
      ...process.env,
      HOME: resolve(expandHomePath(this.homePath)),
    };
  }
}

const clients = new Map<number, ClaudeAppClient>();

export function getClaudeClient(port: number) {
  const existing = clients.get(port);
  if (existing) return existing;

  const client = new ClaudeAppClient(port);
  clients.set(port, client);
  return client;
}
