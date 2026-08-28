"use client";

import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { apiRequest } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format";
import type { AuditLogDto } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  "auth.register": "Account created",
  "auth.login": "Logged in",
  "auth.login_failed": "Failed login attempt",
  "auth.logout": "Logged out",
  "session.revoked": "Revoked a session",
  "session.revoked_all": "Revoked all other sessions",
  "project.created": "Created project",
  "project.renamed": "Renamed project",
  "project.deleted": "Deleted project",
  "file.uploaded": "Uploaded file version",
  "file.downloaded": "Downloaded file",
  "file.deleted": "Deleted file",
  "file.version_restored": "Restored file version",
};

export default function SecurityPage() {
  return (
    <RequireAuth>
      <AppShell>
        <SecurityContent />
      </AppShell>
    </RequireAuth>
  );
}

function SecurityContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => apiRequest<{ entries: AuditLogDto[] }>("/audit-log").then((r) => r.entries),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Security activity</h1>
      <Card>
        <CardHeader
          title="Recent activity"
          description="Security-relevant actions on your account. Never shows secret contents."
        />
        {isLoading && <p className="p-5 text-sm text-slate-500">Loading…</p>}
        {!isLoading && data?.length === 0 && <p className="p-5 text-sm text-slate-500">No activity yet.</p>}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {data?.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                {entry.metadata && (
                  <span className="ml-2 text-slate-500 dark:text-slate-400">
                    {Object.entries(entry.metadata)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-xs text-slate-400">{formatRelativeTime(entry.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
