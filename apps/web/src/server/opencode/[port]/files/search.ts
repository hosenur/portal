import { defineHandler, getQuery } from "nitro/h3";
import { getOpencodeClient } from "../../../lib/opencode-client";
import { parsePort } from "../../../lib/validation";

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const { q } = getQuery(event);

  if (!q || typeof q !== "string") {
    return [];
  }

  const client = getOpencodeClient(port);
  const files = await client.find.files({
    query: { query: q },
  });

  return files;
});
