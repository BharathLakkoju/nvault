import type { NextRequest } from "next/server";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

/**
 * Replaces NestJS's exception filter + validation pipe. Route handlers throw
 * `ApiError` for expected failures; `handler()` turns anything else into an
 * opaque 500 so internal details (stack traces, driver errors) never reach
 * the client.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json(
  data: unknown,
  status = 200,
  opts?: { cache?: "no-store" },
): Response {
  const headers =
    opts?.cache === "no-store" ? { "Cache-Control": "no-store, private" } : undefined;
  return Response.json(data as Record<string, unknown>, { status, headers });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

type RouteParams = Record<string, string>;
type RouteContext = { params: RouteParams };
type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<Response> | Response;

/**
 * Next 15+ delivers `context.params` as a Promise. `handler()` awaits it once
 * so route code stays synchronous (`{ params }` is a plain object inside the
 * handler). The loose `Promise<unknown>` parameter type is what lets the
 * wrapper satisfy Next's generated per-route handler signature for every
 * segment shape.
 */
export function handler(fn: RouteHandler) {
  return async (
    req: NextRequest,
    ctx?: { params: Promise<unknown> },
  ): Promise<Response> => {
    try {
      const params = (ctx?.params ? await ctx.params : {}) as RouteParams;
      return await fn(req, { params });
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json(
          {
            statusCode: err.status,
            message: err.message,
            ...(err.issues ? { issues: err.issues } : {}),
          },
          { status: err.status },
        );
      }
      console.error("[api] unhandled error:", err);
      return Response.json(
        { statusCode: 500, message: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

async function readBodyText(req: Request, maxBytes?: number): Promise<string> {
  if (!maxBytes) return await req.text();
  const declared = req.headers.get("content-length");
  if (declared === null) {
    throw new ApiError(411, "Content-Length header is required.");
  }
  const length = Number(declared);
  if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
    throw new ApiError(413, "Request body is too large.");
  }
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new ApiError(413, "Request body is too large.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total !== length) {
    throw new ApiError(400, "Request body length does not match Content-Length.");
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function readJson<S extends ZodTypeAny>(
  req: Request,
  schema: S,
  maxBytes?: number,
): Promise<ZodInfer<S>> {
  let body: unknown;
  try {
    body = JSON.parse(await readBodyText(req, maxBytes));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, "Request body must be valid JSON");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(
      400,
      "Validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/**
 * Like `readJson`, but tolerates a completely absent/empty body (parses as
 * `{}`). Used for endpoints where the payload is optional (e.g. refresh,
 * which normally carries only the httpOnly cookie).
 */
export async function readJsonOptional<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<ZodInfer<S>> {
  const raw = await req.text();
  let body: unknown = {};
  if (raw.trim().length > 0) {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Request body must be valid JSON");
    }
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(
      400,
      "Validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/** Best-effort client IP for audit logging and rate limiting. */
export function clientIp(req: Request): string | undefined {
  // Prefer platform-injected headers that the edge overwrites (not client-spoofable).
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0]?.trim() || undefined;
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim() || undefined;
  const flyIp = req.headers.get("fly-client-ip");
  if (flyIp) return flyIp.trim() || undefined;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

/**
 * Validates that a cookie-authenticated request originated from this app.
 * Blocks obvious cross-site posts while allowing same-origin navigations that
 * omit `Origin` (checked via Fetch Metadata when present).
 */
export function assertSameOriginCookieAuth(req: Request, allowedOrigin: string): void {
  const origin = req.headers.get("origin");
  if (origin) {
    if (origin !== allowedOrigin) {
      throw new ApiError(403, "Cross-origin request blocked.");
    }
    return;
  }
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") {
    throw new ApiError(403, "Cross-site request blocked.");
  }
}
