"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format";
import { toastError, useToastStore } from "@/lib/toast-store";
import type { SessionDto } from "@/lib/types";

export default function SessionsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <SessionsContent />
      </AppShell>
    </RequireAuth>
  );
}

function shortUserAgent(ua: string | null): string {
  if (!ua) return "Unknown browser";
  const m =
    /(Firefox)\/[\d.]+/.exec(ua) ??
    /(Edg)\/[\d.]+/.exec(ua) ??
    /(Chrome)\/[\d.]+/.exec(ua) ??
    /Version\/[\d.]+.*(Safari)/.exec(ua);
  const browser = m ? (m[1] === "Edg" ? "Edge" : m[1]) : "Browser";
  const os = /\(([^)]+)\)/.exec(ua)?.[1]?.split(";")[0]?.trim();
  return os ? `${browser} · ${os}` : browser;
}

function SessionsContent() {
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiRequest<{ sessions: SessionDto[] }>("/auth/sessions").then((r) => r.sessions),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/auth/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const revokeOthers = useMutation({
    mutationFn: () => apiRequest<void>("/auth/sessions/revoke-others", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      useToastStore.getState().push("success", "Signed out of all other sessions");
    },
  });

  const active = sessions?.filter((s) => !s.revokedAt) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sessions</h1>
        {active.length > 1 && (
          <Button variant="secondary" loading={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
            Log out everywhere else
          </Button>
        )}
      </div>

      <Card>
        <CardHeader
          title="Active sessions"
          description="Each browser you've signed in from. Revoke any you don't recognize — it takes effect immediately."
        />
        {isLoading && <p className="p-5 text-sm text-slate-500">Loading…</p>}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {active.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {shortUserAgent(s.userAgent)}
                  {s.current && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
                      this session
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {s.ipAddress ?? "unknown IP"} · last used {formatRelativeTime(s.lastUsedAt)}
                </p>
              </div>
              {!s.current && (
                <Button
                  variant="ghost"
                  className="text-red-600 dark:text-red-400"
                  loading={revoke.isPending}
                  onClick={() =>
                    revoke.mutate(s.id, {
                      onError: (err) => toastError(err, "Failed to revoke session"),
                    })
                  }
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
