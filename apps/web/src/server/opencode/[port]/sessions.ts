import { defineHandler, getQuery } from "nitro/h3";
import { resolve } from "node:path";
import {
  getInstanceDirectory,
  getOpencodeBaseUrl,
  getOpencodeClient,
} from "../../lib/opencode-client";
import { parsePort } from "../../lib/validation";

type Session = { directory?: string; [k: string]: unknown };

// Returns true when `sessionDir` is `scope` itself or a descendant of `scope`.
// Plain string prefix matching is wrong: it would let `/foo/bar-baz` match
// scope `/foo/bar`. We compare normalized paths and require either equality
// or a `/`-separated descent.
function isUnder(sessionDir: string | undefined, scope: string): boolean {
  if (!sessionDir) return false;
  const s = resolve(scope);
  const d = resolve(sessionDir);
  return d === s || d.startsWith(s + "/");
}

// `client.session.list()` hits GET /session, which OpenCode filters to the
// process's currently active project. /experimental/session returns sessions
// across all projects, matching what OpenCode's own web UI shows. We fall
// back to the SDK call so older OpenCode versions still work.
//
// Sessions are then filtered to those under the Portal instance's
// `--directory`, so each instance shows the sub-tree it was started for.
// Override with `?scope=all` (full list) or `?directory=<path>` (custom).
export default defineHandler(async (event) => {
  const port = parsePort(event);
  const query = getQuery(event);

  let sessions: Session[];
  try {
    const res = await fetch(`${getOpencodeBaseUrl(port)}/experimental/session`);
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    sessions = (await res.json()) as Session[];
  } catch {
    sessions = ((await getOpencodeClient(port).session.list()).data ?? []) as Session[];
  }

  const scope = pickScope(query, port);
  if (!scope) return sessions;

  return sessions.filter((s) => isUnder(s.directory, scope));
});

function pickScope(
  query: Record<string, unknown>,
  port: number,
): string | undefined {
  const explicitScope = typeof query.scope === "string" ? query.scope : undefined;
  if (explicitScope === "all") return undefined;

  const explicitDir =
    typeof query.directory === "string" ? query.directory : undefined;
  if (explicitDir) return explicitDir;

  const instanceDir = getInstanceDirectory(port);
  if (!instanceDir || instanceDir === "/") return undefined;
  return instanceDir;
}
