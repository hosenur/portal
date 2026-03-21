import { defineHandler } from "nitro/h3";
import { HTTPError } from "nitro/h3";
import { getOpencodeClient } from "../../../lib/opencode-client";
import { parsePort } from "../../../lib/validation";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const client = getOpencodeClient(port);
  const project = await client.project.current();

  if (!project.data?.worktree) {
    throw new HTTPError("No project worktree found", { status: 404 });
  }

  const worktree = project.data.worktree;

  try {
    const { stdout } = await execAsync("git diff HEAD", {
      cwd: worktree,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      diff: stdout,
      worktree,
    };
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    throw new HTTPError(err.stderr || err.message || "Failed to get git diff", { status: 500 });
  }
});
