import { getQuery, defineHandler } from "nitro/h3";
import { getCodexClient, getCodexProject } from "../../../lib/codex-client";
import { parsePort } from "../../../lib/validation";

interface FuzzyFile {
  path?: string;
  root?: string;
}

interface FuzzyFileSearchResponse {
  files?: FuzzyFile[];
}

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const query = String(getQuery(event).q ?? "").trim();
  if (!query) return { data: [] };

  const client = getCodexClient(port);
  const project = getCodexProject(port);
  if (!project.worktree) {
    return { data: [] };
  }

  const response = await client.request<FuzzyFileSearchResponse>(
    "fuzzyFileSearch",
    {
      query,
      roots: [project.worktree],
      cancellationToken: null,
    },
  );

  return {
    data: (response.files ?? []).map((file) => file.path ?? file.root ?? ""),
  };
});
