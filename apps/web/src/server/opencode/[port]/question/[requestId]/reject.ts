import { createError, defineHandler, getRouterParam } from "nitro/h3";
import { getOpencodeClientV2 } from "../../../../lib/opencode-client";

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));
  const requestId = getRouterParam(event, "requestId");

  if (!port || isNaN(port)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid port" });
  }

  if (!requestId) {
    throw createError({ statusCode: 400, statusMessage: "Request ID required" });
  }

  const client = getOpencodeClientV2(port);
  const result = await client.question.reject({
    requestID: requestId,
  });

  return result.data;
});
