import { z } from "zod/v4";
import { defineHandler } from "nitro/h3";
import { getOpencodeClientV2 } from "../../../../lib/opencode-client";
import { parsePort, parseRouteParam, parseBody } from "../../../../lib/validation";

const permissionReplySchema = z.object({
  reply: z.enum(["once", "always", "reject"]),
  message: z.string().optional(),
});

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const requestId = parseRouteParam(event, "requestId");
  const body = await parseBody(event, permissionReplySchema);

  const client = getOpencodeClientV2(port);
  const result = await client.permission.reply({
    requestID: requestId,
    reply: body.reply,
    message: body.message,
  });

  return result.data;
});
