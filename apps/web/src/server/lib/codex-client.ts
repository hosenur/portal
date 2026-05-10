import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";
import { getProcessCwdForPort } from "./process-cwd";

const CONFIG_PATH = join(homedir(), ".portal.json");
const REQUEST_TIMEOUT_MS = 60_000;

type RpcId = string | number;
type Provider = "opencode" | "codex";

interface PortalInstance {
  id: string;
  name: string;
  directory: string;
  provider?: Provider;
  backendPort?: number;
  opencodePort: number;
  hostname?: string;
}

interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface RpcMessage {
  id?: RpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: RpcError;
}

export interface PortalEvent {
  id: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface CodexThread {
  id: string;
  preview?: string;
  name?: string | null;
  createdAt?: number;
  updatedAt?: number;
  modelProvider?: string;
  status?: unknown;
  cwd?: string;
  turns?: CodexTurn[];
}

interface CodexTurn {
  id: string;
  items: CodexThreadItem[];
  status: "completed" | "interrupted" | "failed" | "inProgress";
  startedAt: number | null;
  completedAt: number | null;
  error: unknown | null;
}

type CodexThreadItem =
  | {
      type: "userMessage";
      id: string;
      content: Array<{ type: string; text?: string }>;
    }
  | {
      type: "agentMessage";
      id: string;
      text: string;
    }
  | {
      type: "reasoning";
      id: string;
      summary?: string[];
      content?: string[];
    }
  | {
      type: "commandExecution";
      id: string;
      command: string;
      cwd: string;
      status: string;
      aggregatedOutput?: string | null;
      exitCode?: number | null;
      durationMs?: number | null;
    }
  | {
      type: "fileChange";
      id: string;
      changes: unknown[];
      status: string;
    }
  | {
      type: "mcpToolCall" | "dynamicToolCall";
      id: string;
      server?: string;
      tool: string;
      status: string;
      arguments?: unknown;
      result?: unknown;
      error?: unknown;
      contentItems?: unknown[] | null;
      success?: boolean | null;
    };

interface PendingServerRequest {
  rpcId: RpcId;
  method: string;
  params: Record<string, unknown>;
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

function readConfig(): PortalInstance[] {
  try {
    if (!existsSync(CONFIG_PATH)) return [];
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return Array.isArray(config.instances) ? config.instances : [];
  } catch {
    return [];
  }
}

function getCodexInstance(port: number): PortalInstance | null {
  return (
    readConfig().find(
      (instance) =>
        instance.provider === "codex" &&
        (instance.backendPort ?? instance.opencodePort) === port,
    ) ?? null
  );
}

function getHostnameForPort(port: number): string {
  const instance = getCodexInstance(port);
  if (instance?.hostname && instance.hostname !== "0.0.0.0") {
    return instance.hostname;
  }
  return "127.0.0.1";
}

function getCodexDirectory(port: number) {
  return getCodexInstance(port)?.directory ?? getProcessCwdForPort(port);
}

function directoryName(directory: string): string {
  const normalized = directory.replace(/\\+/g, "/").replace(/\/+$/g, "");
  return basename(normalized) || directory;
}

function nowEventId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function statusToSessionStatus(status: unknown) {
  if (
    status &&
    typeof status === "object" &&
    "type" in status &&
    status.type === "active"
  ) {
    return { type: "busy" };
  }
  return { type: "idle" };
}

function userMessageText(item: CodexThreadItem) {
  if (item.type !== "userMessage") return "";
  return item.content
    .filter((content) => content.type === "text" && content.text)
    .map((content) => content.text)
    .join("\n\n");
}

function isResponse(message: RpcMessage) {
  return (
    message.id !== undefined &&
    message.method === undefined &&
    (Object.prototype.hasOwnProperty.call(message, "result") ||
      Object.prototype.hasOwnProperty.call(message, "error"))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function requestKind(method: string) {
  if (method === "item/tool/requestUserInput") return "question";
  return "permission";
}

export function isCodexThreadNotReadyError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error))
    .toLowerCase()
    .trim();

  if (!message.includes("thread")) return false;

  return [
    "not materialized",
    "includeturns is unavailable before first user message",
    "no rollout found",
    "not found",
    "missing thread",
    "no such thread",
    "unknown thread",
    "does not exist",
    "not loaded",
  ].some((snippet) => message.includes(snippet));
}

function permissionFromRequest(
  id: string,
  method: string,
  params: Record<string, unknown>,
): PendingPermission {
  const threadId = extractString(params.threadId);
  const itemId = extractString(params.itemId);

  if (method === "item/fileChange/requestApproval") {
    return {
      id,
      sessionID: threadId,
      permission: "file change",
      patterns: [extractString(params.grantRoot) || "workspace changes"],
      message: extractString(params.reason) || undefined,
      tool: { callID: itemId, messageID: itemId },
    };
  }

  if (method === "item/permissions/requestApproval") {
    return {
      id,
      sessionID: threadId,
      permission: "additional permissions",
      patterns: [extractString(params.cwd) || "workspace"],
      message: extractString(params.reason) || undefined,
      tool: { callID: itemId, messageID: itemId },
    };
  }

  const command =
    extractString(params.command) ||
    (isRecord(params.networkApprovalContext)
      ? extractString(params.networkApprovalContext.host)
      : "");

  return {
    id,
    sessionID: threadId,
    permission: isRecord(params.networkApprovalContext)
      ? "network access"
      : "command execution",
    patterns: [command || extractString(params.cwd) || "command"],
    message: extractString(params.reason) || undefined,
    tool: { callID: itemId, messageID: itemId },
  };
}

function questionFromRequest(
  id: string,
  params: Record<string, unknown>,
): PendingQuestion {
  const questions = Array.isArray(params.questions) ? params.questions : [];

  return {
    id,
    sessionID: extractString(params.threadId),
    tool: { callID: extractString(params.itemId) },
    questions: questions.filter(isRecord).map((question) => ({
      question: extractString(question.question),
      header: extractString(question.header),
      options: Array.isArray(question.options)
        ? question.options.filter(isRecord).map((option) => ({
            label: extractString(option.label),
            description: extractString(option.description),
          }))
        : [],
      multiple: false,
      custom: question.isOther !== false,
    })),
  };
}

export function codexThreadToSession(thread: CodexThread) {
  const created = (thread.createdAt ?? Date.now() / 1000) * 1000;
  const updated =
    (thread.updatedAt ?? thread.createdAt ?? Date.now() / 1000) * 1000;

  return {
    id: thread.id,
    title: thread.name || thread.preview || "New Codex thread",
    agent: "codex",
    time: {
      created,
      updated,
    },
    model: {
      providerID: thread.modelProvider ?? "openai",
      modelID: "",
    },
  };
}

export function codexThreadToSessionMessages(thread: CodexThread) {
  const messages: unknown[] = [];

  for (const turn of thread.turns ?? []) {
    const started = (turn.startedAt ?? Date.now() / 1000) * 1000;
    const completed = turn.completedAt ? turn.completedAt * 1000 : undefined;
    let offset = 0;

    for (const item of turn.items) {
      if (item.type === "userMessage") {
        messages.push({
          id: item.id,
          type: "user",
          text: userMessageText(item),
          time: {
            created: started + offset,
          },
        });
        offset += 1;
      }
    }

    const assistantContent: unknown[] = [];

    for (const item of turn.items) {
      if (item.type === "agentMessage" && item.text) {
        assistantContent.push({ type: "text", text: item.text });
        continue;
      }

      if (item.type === "reasoning") {
        const text = [...(item.summary ?? []), ...(item.content ?? [])].join(
          "\n",
        );
        if (text) {
          assistantContent.push({ type: "reasoning", id: item.id, text });
        }
        continue;
      }

      if (item.type === "commandExecution") {
        const isDone = item.status !== "inProgress";
        assistantContent.push({
          type: "tool",
          id: item.id,
          name: "bash",
          provider: { executed: isDone, metadata: {} },
          time: {
            created: started + offset,
            ...(isDone
              ? {
                  ran: started + offset,
                  completed: completed ?? started + offset,
                }
              : {}),
          },
          state: isDone
            ? item.status === "completed"
              ? {
                  status: "completed",
                  input: { command: item.command, cwd: item.cwd },
                  structured: {
                    exitCode: item.exitCode,
                    durationMs: item.durationMs,
                  },
                  content: item.aggregatedOutput
                    ? [{ type: "text", text: item.aggregatedOutput }]
                    : [],
                }
              : {
                  status: "error",
                  input: { command: item.command, cwd: item.cwd },
                  structured: {},
                  content: [],
                  error: {
                    type: "unknown",
                    message: item.status,
                  },
                }
            : {
                status: "running",
                input: { command: item.command, cwd: item.cwd },
                structured: {},
                content: [],
              },
        });
        offset += 1;
        continue;
      }

      if (item.type === "fileChange") {
        const isDone = item.status !== "inProgress";
        assistantContent.push({
          type: "tool",
          id: item.id,
          name: "edit",
          provider: { executed: isDone, metadata: {} },
          time: {
            created: started + offset,
            ...(isDone
              ? {
                  ran: started + offset,
                  completed: completed ?? started + offset,
                }
              : {}),
          },
          state: isDone
            ? item.status === "completed"
              ? {
                  status: "completed",
                  input: { changes: item.changes },
                  structured: {},
                  content: [],
                }
              : {
                  status: "error",
                  input: { changes: item.changes },
                  structured: {},
                  content: [],
                  error: {
                    type: "unknown",
                    message: item.status,
                  },
                }
            : {
                status: "running",
                input: { changes: item.changes },
                structured: {},
                content: [],
              },
        });
        offset += 1;
        continue;
      }

      if (item.type === "mcpToolCall" || item.type === "dynamicToolCall") {
        const isDone = item.status !== "inProgress";
        assistantContent.push({
          type: "tool",
          id: item.id,
          name: item.tool,
          provider: { executed: isDone, metadata: { server: item.server } },
          time: {
            created: started + offset,
            ...(isDone
              ? {
                  ran: started + offset,
                  completed: completed ?? started + offset,
                }
              : {}),
          },
          state: isDone
            ? item.status === "completed"
              ? {
                  status: "completed",
                  input: isRecord(item.arguments) ? item.arguments : {},
                  structured: isRecord(item.result) ? item.result : {},
                  content: [],
                }
              : {
                  status: "error",
                  input: isRecord(item.arguments) ? item.arguments : {},
                  structured: {},
                  content: [],
                  error: {
                    type: "unknown",
                    message: JSON.stringify(item.error ?? item.status),
                  },
                }
            : {
                status: "running",
                input: isRecord(item.arguments) ? item.arguments : {},
                structured: {},
                content: [],
              },
        });
        offset += 1;
      }
    }

    if (assistantContent.length > 0 || turn.error) {
      messages.push({
        id: `${turn.id}-assistant`,
        type: "assistant",
        agent: "codex",
        model: {
          id: "",
          providerID: "openai",
          variant: "default",
        },
        content: assistantContent,
        time: {
          created: started + offset + 1,
          ...(completed ? { completed } : {}),
        },
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        ...(turn.status === "failed"
          ? {
              finish: "error",
              error: {
                type: "unknown",
                message: JSON.stringify(turn.error ?? "Turn failed"),
              },
            }
          : {}),
      });
    }
  }

  return messages;
}

function notificationToEvents(message: RpcMessage): PortalEvent[] {
  const method = message.method;
  const params = isRecord(message.params) ? message.params : {};

  switch (method) {
    case "thread/started": {
      const thread = isRecord(params.thread)
        ? (params.thread as unknown as CodexThread)
        : null;
      return thread
        ? [
            {
              id: nowEventId("codex-thread-started"),
              type: "session.created",
              properties: { info: codexThreadToSession(thread) },
            },
          ]
        : [];
    }

    case "thread/archived":
      return [
        {
          id: nowEventId("codex-thread-archived"),
          type: "session.deleted",
          properties: { sessionID: extractString(params.threadId) },
        },
      ];

    case "thread/status/changed":
      return [
        {
          id: nowEventId("codex-thread-status"),
          type: "session.status",
          properties: {
            sessionID: extractString(params.threadId),
            status: statusToSessionStatus(params.status),
          },
        },
      ];

    case "turn/started":
      return [
        {
          id: nowEventId("codex-turn-started"),
          type: "session.status",
          properties: {
            sessionID: extractString(params.threadId),
            status: { type: "busy" },
          },
        },
        {
          id: nowEventId("codex-turn-message"),
          type: "message.updated",
          properties: { sessionID: extractString(params.threadId) },
        },
      ];

    case "item/started": {
      const item = isRecord(params.item)
        ? (params.item as CodexThreadItem)
        : null;
      if (item?.type === "userMessage") {
        return [
          {
            id: item.id,
            type: "session.next.prompted",
            properties: {
              sessionID: extractString(params.threadId),
              timestamp: Number(params.startedAtMs) || Date.now(),
              prompt: { text: userMessageText(item), files: [], agents: [] },
            },
          },
        ];
      }
      return [
        {
          id: nowEventId("codex-item-started"),
          type: "message.updated",
          properties: { sessionID: extractString(params.threadId) },
        },
      ];
    }

    case "item/agentMessage/delta":
    case "item/reasoning/summaryTextDelta":
    case "item/reasoning/textDelta":
      return [
        {
          id: nowEventId("codex-message-delta"),
          type: "message.part.delta",
          properties: { sessionID: extractString(params.threadId) },
        },
      ];

    case "item/completed":
    case "rawResponseItem/completed":
      return [
        {
          id: nowEventId("codex-item-completed"),
          type: "message.updated",
          properties: { sessionID: extractString(params.threadId) },
        },
      ];

    case "turn/completed":
      return [
        {
          id: nowEventId("codex-turn-completed"),
          type: "session.idle",
          properties: { sessionID: extractString(params.threadId) },
        },
        {
          id: nowEventId("codex-turn-completed-message"),
          type: "message.updated",
          properties: { sessionID: extractString(params.threadId) },
        },
      ];

    case "turn/diff/updated":
      return [
        {
          id: nowEventId("codex-diff"),
          type: "session.diff",
          properties: { sessionID: extractString(params.threadId) },
        },
      ];

    default:
      return [];
  }
}

class CodexAppClient {
  private ws: WebSocket | null = null;
  private connectionPromise: Promise<void> | null = null;
  private nextId = 1;
  private pending = new Map<RpcId, PendingRequest>();
  private eventListeners = new Set<(event: PortalEvent) => void>();
  private serverRequests = new Map<string, PendingServerRequest>();

  constructor(
    private readonly port: number,
    private readonly hostname: string,
  ) {}

  get directory() {
    return getCodexDirectory(this.port);
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    await this.ensureReady();
    return this.rawRequest<T>(method, params);
  }

  subscribe(listener: (event: PortalEvent) => void) {
    this.eventListeners.add(listener);
    void this.ensureReady()
      .then(() => {
        if (!this.eventListeners.has(listener)) return;
        listener({
          id: nowEventId("codex-connected"),
          type: "server.connected",
          properties: {},
        });
      })
      .catch((error) => {
        if (!this.eventListeners.has(listener)) return;
        listener({
          id: nowEventId("codex-connect-error"),
          type: "portal.event.error",
          properties: {
            message:
              error instanceof Error
                ? error.message
                : "Failed to connect to Codex app-server",
          },
        });
      });

    return () => {
      this.eventListeners.delete(listener);
    };
  }

  getPendingPermissions() {
    return [...this.serverRequests.entries()]
      .filter(([, request]) => requestKind(request.method) === "permission")
      .map(([id, request]) =>
        permissionFromRequest(id, request.method, request.params),
      );
  }

  getPendingQuestions() {
    return [...this.serverRequests.entries()]
      .filter(([, request]) => requestKind(request.method) === "question")
      .map(([id, request]) => questionFromRequest(id, request.params));
  }

  async replyPermission(id: string, reply: "once" | "always" | "reject") {
    await this.ensureReady();
    const request = this.serverRequests.get(id);
    if (!request) throw new Error("Permission request not found");

    let result: unknown;
    if (request.method === "item/permissions/requestApproval") {
      const permissions = isRecord(request.params.permissions)
        ? request.params.permissions
        : {};
      result = {
        permissions:
          reply === "reject"
            ? {}
            : {
                ...(isRecord(permissions.network)
                  ? { network: permissions.network }
                  : {}),
                ...(isRecord(permissions.fileSystem)
                  ? { fileSystem: permissions.fileSystem }
                  : {}),
              },
        scope: reply === "always" ? "session" : "turn",
      };
    } else {
      result = {
        decision:
          reply === "reject"
            ? "decline"
            : reply === "always"
              ? "acceptForSession"
              : "accept",
      };
    }

    this.send({ id: request.rpcId, result });
    this.serverRequests.delete(id);
    this.emit({
      id: nowEventId("codex-permission-replied"),
      type: "permission.replied",
      properties: { requestID: id },
    });
  }

  async replyQuestion(id: string, answers: string[][]) {
    await this.ensureReady();
    const request = this.serverRequests.get(id);
    if (!request) throw new Error("Question request not found");

    const questions = Array.isArray(request.params.questions)
      ? request.params.questions
      : [];
    const mappedAnswers: Record<string, { answers: string[] }> = {};
    questions.filter(isRecord).forEach((question, index) => {
      const questionId = extractString(question.id);
      if (questionId) {
        mappedAnswers[questionId] = { answers: answers[index] ?? [] };
      }
    });

    this.send({ id: request.rpcId, result: { answers: mappedAnswers } });
    this.serverRequests.delete(id);
    this.emit({
      id: nowEventId("codex-question-replied"),
      type: "question.replied",
      properties: { requestID: id },
    });
  }

  async rejectQuestion(id: string) {
    return this.replyQuestion(id, []);
  }

  private async ensureReady() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this.connect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async connect() {
    const ws = new WebSocket(`ws://${this.hostname}:${this.port}`);
    this.ws = ws;

    ws.addEventListener("message", (event) => {
      void this.handleMessage(event.data);
    });
    ws.addEventListener("close", () => {
      if (this.ws === ws) {
        this.ws = null;
      }
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Codex app-server connection closed"));
      }
      this.pending.clear();
    });
    ws.addEventListener("error", () => {
      this.emit({
        id: nowEventId("codex-error"),
        type: "portal.event.error",
        properties: { message: "Codex app-server connection failed" },
      });
    });

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Failed to connect to Codex app-server"));
      };
      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
    });

    await this.rawRequest("initialize", {
      clientInfo: {
        name: "openportal",
        title: "OpenPortal",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: true,
      },
    });
    this.send({ method: "initialized", params: {} });
  }

  private rawRequest<T = unknown>(
    method: string,
    params?: unknown,
  ): Promise<T> {
    const id = this.nextId;
    this.nextId += 1;

    const promise = new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });
    });

    this.send(params === undefined ? { id, method } : { id, method, params });
    return promise;
  }

  private async handleMessage(data: unknown) {
    const text =
      typeof data === "string"
        ? data
        : data instanceof ArrayBuffer
          ? new TextDecoder().decode(data)
          : "";
    if (!text) return;

    let message: RpcMessage;
    try {
      message = JSON.parse(text) as RpcMessage;
    } catch {
      return;
    }

    if (message.method) {
      if (message.id !== undefined) {
        this.handleServerRequest(message);
      } else {
        for (const event of notificationToEvents(message)) {
          this.emit(event);
        }
      }
      return;
    }

    if (isResponse(message) && message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  private handleServerRequest(message: RpcMessage) {
    if (
      message.id === undefined ||
      !message.method ||
      !isRecord(message.params)
    ) {
      return;
    }

    const id = String(message.id);
    this.serverRequests.set(id, {
      rpcId: message.id,
      method: message.method,
      params: message.params,
    });

    if (requestKind(message.method) === "question") {
      this.emit({
        id: nowEventId("codex-question-asked"),
        type: "question.asked",
        properties: questionFromRequest(
          id,
          message.params,
        ) as unknown as Record<string, unknown>,
      });
      return;
    }

    this.emit({
      id: nowEventId("codex-permission-asked"),
      type: "permission.asked",
      properties: permissionFromRequest(
        id,
        message.method,
        message.params,
      ) as unknown as Record<string, unknown>,
    });
  }

  private send(message: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Codex app-server is not connected");
    }
    this.ws.send(JSON.stringify(message));
  }

  private emit(event: PortalEvent) {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }
}

const clientCache = new Map<string, CodexAppClient>();

export function getCodexClient(port: number) {
  const hostname = getHostnameForPort(port);
  const key = `${hostname}:${port}`;
  const cached = clientCache.get(key);
  if (cached) return cached;

  const client = new CodexAppClient(port, hostname);
  clientCache.set(key, client);
  return client;
}

export function getCodexProject(port: number) {
  const instance = getCodexInstance(port);
  const worktree = getCodexDirectory(port) ?? "";
  return {
    name: instance?.name ?? (worktree ? directoryName(worktree) : "Codex"),
    worktree,
  };
}
