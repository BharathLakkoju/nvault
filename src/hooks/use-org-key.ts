"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { openOrgKey } from "@/lib/vault-client";
import { useOrganization } from "./use-organizations";

/**
 * Recovers the Organization Key for `orgId` by unwrapping the caller's
 * member-addressed copy with their (in-memory) RSA private key.
 *
 * `null` orgKey with no error means "not ready yet" (vault locked, org
 * detail still loading, or the admin has not granted this member a key).
 */
export function useOrgKey(orgId: string | null | undefined) {
  const privateKey = useAuthStore((s) => s.privateKey);
  const { data: detail } = useOrganization(orgId ?? null);
  const [orgKey, setOrgKey] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const wrapped = detail?.self.wrappedOrgKey ?? null;

  useEffect(() => {
    setOrgKey(null);
    setError(null);
    if (!privateKey || !wrapped) return;
    let cancelled = false;
    openOrgKey(privateKey, wrapped)
      .then((key) => {
        if (!cancelled) setOrgKey(key);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [privateKey, wrapped]);

  return {
    orgKey,
    error,
    /** True once we know the member has no key granted yet. */
    awaitingKeyGrant: !!detail && detail.self.status !== "ACTIVE",
  };
}
