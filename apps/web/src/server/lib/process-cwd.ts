import { execFileSync } from "child_process";
import { existsSync, readlinkSync } from "fs";

const COMMAND_TIMEOUT_MS = 1_000;
const CACHE_TTL_MS = 5_000;

interface Cached<T> {
  expiresAt: number;
  value: T;
}

const pidByPortCache = new Map<number, Cached<number | null>>();
const cwdByPidCache = new Map<number, Cached<string | null>>();

function fromCache<T>(cache: Map<number, Cached<T>>, key: number): T | null {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.value;
}

function setCache<T>(cache: Map<number, Cached<T>>, key: number, value: T): T {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return value;
}

function runLsof(args: string[]) {
  try {
    return execFileSync("lsof", args, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: COMMAND_TIMEOUT_MS,
    });
  } catch {
    return "";
  }
}

function parsePid(output: string) {
  for (const line of output.split("\n")) {
    if (!line.startsWith("p")) continue;
    const pid = Number.parseInt(line.slice(1), 10);
    if (Number.isSafeInteger(pid) && pid > 0) return pid;
  }

  return null;
}

function parseCwd(output: string) {
  for (const line of output.split("\n")) {
    if (!line.startsWith("n")) continue;
    const cwd = line.slice(1);
    if (cwd && existsSync(cwd)) return cwd;
  }

  return null;
}

export function getListeningPidForPort(port: number) {
  if (!Number.isSafeInteger(port) || port <= 0 || port > 65_535) return null;

  const cached = fromCache(pidByPortCache, port);
  if (cached !== null) return cached;

  const output = runLsof(["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-F", "p"]);

  return setCache(pidByPortCache, port, parsePid(output));
}

export function getProcessCwd(pid: number | null | undefined) {
  if (!pid || !Number.isSafeInteger(pid) || pid <= 0) return null;

  const cached = fromCache(cwdByPidCache, pid);
  if (cached !== null) return cached;

  if (process.platform === "linux") {
    try {
      const cwd = readlinkSync(`/proc/${pid}/cwd`);
      if (cwd && existsSync(cwd)) return setCache(cwdByPidCache, pid, cwd);
    } catch {
      // Fall through to lsof for platforms without procfs access.
    }
  }

  const output = runLsof(["-a", "-p", String(pid), "-d", "cwd", "-F", "n"]);
  return setCache(cwdByPidCache, pid, parseCwd(output));
}

export function getProcessCwdForPort(port: number) {
  return getProcessCwd(getListeningPidForPort(port));
}
