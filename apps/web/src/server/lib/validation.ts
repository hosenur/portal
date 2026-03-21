import { z } from "zod/v4";
import { HTTPError } from "nitro/h3";
import type { H3Event } from "nitro/h3";
import { getRouterParam, readBody } from "nitro/h3";

const portSchema = z.int().min(1).max(65535);
const idSchema = z.string().min(1);

export function parsePort(event: H3Event): number {
  const raw = Number(getRouterParam(event, "port"));
  const result = portSchema.safeParse(raw);
  if (!result.success) {
    throw new HTTPError("Invalid port", { status: 400 });
  }
  return result.data;
}

export function parseRouteParam(event: H3Event, name: string): string {
  const raw = getRouterParam(event, name);
  const result = idSchema.safeParse(raw);
  if (!result.success) {
    throw new HTTPError(`${name} is required`, { status: 400 });
  }
  return result.data;
}

export async function parseBody<T>(event: H3Event, schema: z.ZodType<T>): Promise<T> {
  const raw = await readBody(event);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new HTTPError(z.prettifyError(result.error), { status: 400 });
  }
  return result.data;
}
