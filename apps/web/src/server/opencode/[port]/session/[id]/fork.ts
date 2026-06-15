import { z } from "zod/v4";
import { defineHandler } from "nitro/h3";
import { getOpencodeClient } from "../../../../lib/opencode-client";
import {
  parsePort,
  parseRouteParam,
  parseBody,
} from "../../../../lib/validation";

const forkBodySchema = z.object({
  messageID: z.string().optional(),
});

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const id = parseRouteParam(event, "id");
  const body = await parseBody(event, forkBodySchema);

  const client = getOpencodeClient(port);
  const result = await client.session.fork({
    sessionID: id,
    messageID: body.messageID,
  });

  return result.data;
});
