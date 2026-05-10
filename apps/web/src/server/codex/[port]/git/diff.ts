import { defineHandler } from "nitro/h3";
import { getCodexClient, getCodexProject } from "../../../lib/codex-client";
import { parsePort } from "../../../lib/validation";

interface GitDiffResponse {
  diff?: string;
}

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const client = getCodexClient(port);
  const project = getCodexProject(port);

  if (!project.worktree) {
    return {
      diff: "",
      worktree: "",
    };
  }

  try {
    const response = await client.request<GitDiffResponse>("gitDiffToRemote", {
      cwd: project.worktree,
    });
    return {
      diff: response.diff ?? "",
      worktree: project.worktree,
    };
  } catch {
    return {
      diff: "",
      worktree: project.worktree,
    };
  }
});
