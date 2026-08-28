import { NextResponse } from "next/server";
import { logout } from "@/server/auth/service";
import { requireAuth } from "@/server/auth/require-auth";
import { clearRefreshCookie } from "@/server/auth/cookies";
import { clientIp, handler } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  await logout(auth.userId, auth.sessionId, clientIp(req));
  const res = new NextResponse(null, { status: 204 });
  clearRefreshCookie(res);
  return res;
});
