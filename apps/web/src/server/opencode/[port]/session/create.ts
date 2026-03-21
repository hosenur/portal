import { z } from "zod/v4";
import { defineHandler } from "nitro/h3";
import { getOpencodeClient } from "../../../lib/opencode-client";
import { parsePort, parseBody } from "../../../lib/validation";

const createSessionSchema = z.object({
  title: z.string().optional(),
  parentID: z.string().optional(),
});

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const body = await parseBody(event, createSessionSchema);

  const client = getOpencodeClient(port);
  const session = await client.session.create({
    body: { title: body.title, parentID: body.parentID },
  });

  return session.data;
});
