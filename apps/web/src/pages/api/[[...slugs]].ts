import type { NextApiRequest, NextApiResponse } from "next";
import { Elysia } from "elysia";
import { createOpencodeClient } from "@opencode-ai/sdk";

if (!process.env.OPENCODE_SERVER_URL) {
  throw new Error("OPENCODE_SERVER_URL environment variable is required");
}

const opencodeClient = createOpencodeClient({
  baseUrl: process.env.OPENCODE_SERVER_URL,
});

const app = new Elysia({ prefix: "/api" })
  .get("/", () => ({ message: "Hello from Elysia!" }))
  .get("/sessions", async () => {
    const sessions = await opencodeClient.session.list();
    return sessions;
  })
  .post("/sessions", async () => {
    const session = await opencodeClient.session.create({});
    return session;
  })
  .get("/sessions/:id", async ({ params }) => {
    const session = await opencodeClient.session.get({
      path: { id: params.id },
    });
    return session;
  })
  .get("/sessions/:id/messages", async ({ params }) => {
    const messages = await opencodeClient.session.messages({
      path: { id: params.id },
    });
    return messages;
  })
  .post("/sessions/:id/prompt", async ({ params, body }) => {
    const { text, model } = body as {
      text: string;
      model?: { providerID: string; modelID: string };
    };
    const response = await opencodeClient.session.prompt({
      path: { id: params.id },
      body: {
        ...(model && { model }),
        parts: [{ type: "text", text }],
      },
    });
    return response;
  })
  .get("/models", async () => {
    const config = await opencodeClient.config.providers();
    return config;
  })
  .get("/project/current", async () => {
    const project = await opencodeClient.project.current();
    return project;
  })
  .get("/files/search", async ({ query }) => {
    const { q } = query as { q?: string };
    if (!q) {
      return [];
    }
    const files = await opencodeClient.find.files({
      query: { query: q },
    });
    return files;
  })
  .delete("/sessions/:id", async ({ params }) => {
    await opencodeClient.session.delete({
      path: { id: params.id },
    });
    return { success: true };
  });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          headers.append(key, v);
        }
      } else {
        headers.set(key, value);
      }
    }
  }

  const body = await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const request = new Request(url, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method || "")
      ? undefined
      : new Uint8Array(body),
  });

  const response = await app.handle(request);

  res.status(response.status);

  response.headers.forEach((value: string, key: string) => {
    res.setHeader(key, value);
  });

  const responseBody = await response.text();
  res.send(responseBody);
}
