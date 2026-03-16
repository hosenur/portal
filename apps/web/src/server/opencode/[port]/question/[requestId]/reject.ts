import { defineHandler } from "nitro/h3";
import { getOpencodeClientV2 } from "../../../../lib/opencode-client";
import { parsePort, parseRouteParam } from "../../../../lib/validation";

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const requestId = parseRouteParam(event, "requestId");

  const client = getOpencodeClientV2(port);
  const result = await client.question.reject({
    requestID: requestId,
  });

  return result.data;
});
