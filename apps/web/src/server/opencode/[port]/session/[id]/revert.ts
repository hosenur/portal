import { z } from "zod/v4";
import { HTTPError, defineHandler } from "nitro/h3";
import { formatErrorMessage } from "@/lib/error-message";
import { getOpencodeClient } from "../../../../lib/opencode-client";
import {
  parsePort,
  parseRouteParam,
  parseBody,
} from "../../../../lib/validation";

const revertBodySchema = z.object({
  messageID: z.string().min(1),
  partID: z.string().optional(),
});

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const id = parseRouteParam(event, "id");
  const body = await parseBody(event, revertBodySchema);

  const client = getOpencodeClient(port);
  try {
    const result = await client.session.revert({
      sessionID: id,
      messageID: body.messageID,
      partID: body.partID,
    });

    return result.data;
  } catch (error) {
    throw new HTTPError(formatErrorMessage(error, "Failed to revert session"), {
      status: 500,
    });
  }
});
