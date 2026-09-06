import { headers } from "next/headers";

/** Nonce forwarded by src/proxy.ts for inline scripts/styles on app routes. */
export async function cspNonce(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-nonce") ?? undefined;
}
