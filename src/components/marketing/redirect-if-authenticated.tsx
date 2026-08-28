"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Renders nothing. When an already-authenticated user lands on a marketing
 * page (most importantly `/`), send them to the dashboard. Anonymous users and
 * search-engine crawlers keep the server-rendered marketing content, so this
 * costs nothing for SEO.
 */
export function RedirectIfAuthenticated({ to = "/dashboard" }: { to?: string }) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace(to);
  }, [status, router, to]);

  return null;
}
