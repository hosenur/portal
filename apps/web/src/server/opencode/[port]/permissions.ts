import { defineHandler, getRouterParam } from "nitro/h3";
import { getOpencodeBaseUrl } from "../../lib/opencode-client";

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));

  if (!port || isNaN(port)) {
    throw new Error("Invalid port");
  }

  const baseUrl = getOpencodeBaseUrl(port);
  const response = await fetch(`${baseUrl}/permission`);

  if (!response.ok) {
    throw new Error(`Failed to list permissions: ${response.statusText}`);
  }

  return response.json();
});
