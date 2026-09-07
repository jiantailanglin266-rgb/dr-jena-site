import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { AuthError, requireOrg } from "./tenant";
import type { Permission } from "./rbac";
import type { SessionUser } from "./auth";
import { checkRateLimit } from "./rate-limit";

import { ApiError } from "./errors";
export { ApiError };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof AuthError) return fail(err.message, err.status);
  if (err instanceof ApiError) return fail(err.message, err.status, err.details);
  if (err instanceof ZodError) return fail("Validation error", 422, err.issues);
  const msg = err instanceof Error ? err.message : "Internal error";
  if (process.env.NODE_ENV !== "production") console.error("[api]", err);
  const known = ["AICostLimitExceeded", "not found", "Not found"];
  const status = known.some((k) => msg.includes(k)) ? 400 : 500;
  return fail(process.env.NODE_ENV === "production" && status === 500 ? "Internal error" : msg, status);
}

type Handler<Ctx> = (req: Request, ctx: Ctx & { user: SessionUser }) => Promise<Response>;

/** Wrap a route handler with auth + permission + rate limiting + error handling. */
export function withAuth<Ctx extends object = object>(permission: Permission | null, handler: Handler<Ctx>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const user = await requireOrg(permission ?? undefined);
      const rl = await checkRateLimit(`api:${user.id}`, 300, 60);
      if (!rl.allowed) return fail("Rate limit exceeded", 429);
      return await handler(req, { ...ctx, user });
    } catch (err) {
      return handleError(err);
    }
  };
}

export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
  return schema.parse(json);
}

export function parseQuery<T extends z.ZodTypeAny>(req: Request, schema: T): z.infer<T> {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (obj[k] = v));
  return schema.parse(obj);
}

export async function resolveParams<T>(params: T | Promise<T>): Promise<T> {
  return await params;
}
