import { HTTPError, defineHandler } from "nitro/h3";
import { getClaudeClient } from "../../../../lib/claude-client";
import { parsePort, parseRouteParam } from "../../../../lib/validation";

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const id = parseRouteParam(event, "id");

  try {
    return await getClaudeClient(port).abort(id);
  } catch (error) {
    throw new HTTPError(
      error instanceof Error ? error.message : "No active Claude turn to abort",
      { status: 409 },
    );
  }
});
