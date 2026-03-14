import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { getOpencodeBaseUrl } from "../../../../lib/opencode-client";

interface PermissionReplyBody {
  reply: "once" | "always" | "reject";
}

export default defineHandler(async (event) => {
  const port = Number(getRouterParam(event, "port"));
  const permissionId = getRouterParam(event, "permissionId");

  if (!port || isNaN(port)) {
    throw new Error("Invalid port");
  }

  if (!permissionId) {
    throw new Error("Permission ID required");
  }

  const body = await readBody<PermissionReplyBody>(event);
  const reply = body?.reply;

  if (!reply || !["once", "always", "reject"].includes(reply)) {
    throw new Error("Reply must be one of: once, always, reject");
  }

  const baseUrl = getOpencodeBaseUrl(port);
  const response = await fetch(`${baseUrl}/permission/${permissionId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reply to permission: ${response.statusText}`);
  }

  return response.json();
});
