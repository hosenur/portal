import { z } from "zod/v4";
import { defineHandler } from "nitro/h3";
import { getCodexClient } from "../../../../lib/codex-client";
import {
  parseBody,
  parsePort,
  parseRouteParam,
} from "../../../../lib/validation";

const permissionReplySchema = z.object({
  reply: z.enum(["once", "always", "reject"]),
  message: z.string().optional(),
});

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const requestId = parseRouteParam(event, "requestId");
  const body = await parseBody(event, permissionReplySchema);

  await getCodexClient(port).replyPermission(requestId, body.reply);
  return {};
});
