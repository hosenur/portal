import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { getOpencodeClient } from "../../../lib/opencode-client";

interface CreateSessionBody {
  title?: string;
  parentID?: string;
}

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));

  if (!port || isNaN(port)) {
    throw new Error("Invalid port");
  }

  const body = await readBody<CreateSessionBody>(event);
  const client = getOpencodeClient(port);
  const session = await client.session.create({
    body: { title: body?.title, parentID: body?.parentID },
  });

  return session.data;
});
