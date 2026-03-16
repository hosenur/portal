import { createError, defineHandler, getRouterParam, readBody } from "nitro/h3";
import { getOpencodeClientV2 } from "../../../../lib/opencode-client";

interface PermissionReplyBody {
  reply: "once" | "always" | "reject";
  message?: string;
}

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));
  const requestId = getRouterParam(event, "requestId");

  if (!port || isNaN(port)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid port" });
  }

  if (!requestId) {
    throw createError({ statusCode: 400, statusMessage: "Request ID required" });
  }

  const body = await readBody<PermissionReplyBody>(event);

  if (!body?.reply || !["once", "always", "reject"].includes(body.reply)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid reply. Must be 'once', 'always', or 'reject'",
    });
  }

  const client = getOpencodeClientV2(port);
  const result = await client.permission.reply({
    requestID: requestId,
    reply: body.reply,
    message: body.message,
  });

  return result.data;
});
