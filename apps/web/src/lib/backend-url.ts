export type BackendProvider = "opencode" | "codex" | "claude";

export function normalizeProvider(provider: unknown): BackendProvider {
  if (provider === "claude") return "claude";
  return provider === "codex" ? "codex" : "opencode";
}

export function backendBasePath(
  provider: BackendProvider | undefined,
  port: number,
) {
  return `/api/${normalizeProvider(provider)}/${port}`;
}
