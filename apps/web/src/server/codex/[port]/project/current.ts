import { defineHandler } from "nitro/h3";
import { getCodexProject } from "../../../lib/codex-client";
import { parsePort } from "../../../lib/validation";

export default defineHandler((event) => {
  const port = parsePort(event);
  return getCodexProject(port);
});
