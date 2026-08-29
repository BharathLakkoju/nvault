"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useOrganization } from "@/hooks/use-organizations";
import { useOrgActivity } from "@/hooks/use-org-members";
import { formatRelativeTime } from "@/lib/format";

const ACTION_LABELS: Record<string, string> = {
  "org.created": "created the organization",
  "org.renamed": "updated organization settings",
  "org.member_invited": "invited a member",
  "org.invite_revoked": "revoked an invitation",
  "org.member_joined": "accepted an invitation",
  "org.member_key_granted": "granted key access",
  "org.member_removed": "removed a member",
  "org.member_role_changed": "changed a member's role",
  "org.key_rotated": "rotated the organization key",
  "org.ownership_transferred": "transferred ownership",
  "project.created": "created a project",
  "project.renamed": "renamed a project",
  "project.deleted": "deleted a project",
  "project.moved_to_org": "moved a project into the organization",
  "file.uploaded": "uploaded a file version",
  "file.downloaded": "downloaded a file",
  "file.deleted": "deleted a file",
  "file.version_restored": "restored a file version",
};

export default function OrgActivityPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <AppShell>
        <ActivityContent id={id} />
      </AppShell>
    </RequireAuth>
  );
}

function ActivityContent({ id }: { id: string }) {
  const { data: org } = useOrganization(id);
  const isAdmin = org?.self.role === "ADMIN" || org?.self.role === "OWNER";
  const { data: entries, isLoading, error } = useOrgActivity(id, !!isAdmin);

  return (
    <div className="space-y-6">
      <div>
        {org && (
          <Link href={`/organizations/${id}`} className="text-sm text-accent-600 hover:underline">
            ← {org.organization.name}
          </Link>
        )}
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Activity</h1>
      </div>

      <Card>
        {(isLoading || (!org && !error)) && <p className="p-5 text-sm text-slate-500">Loading…</p>}
        {error && (
          <p className="p-5 text-sm text-slate-500 dark:text-slate-400">
            You don&apos;t have permission to view this organization&apos;s activity.
          </p>
        )}
        {entries && entries.length === 0 && (
          <p className="p-5 text-sm text-slate-500 dark:text-slate-400">No activity yet.</p>
        )}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {entries?.map((e) => (
            <li key={e.id} className="px-5 py-3 text-sm">
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {e.actorEmail ?? "Someone"}
              </span>{" "}
              <span className="text-slate-600 dark:text-slate-300">
                {ACTION_LABELS[e.action] ?? e.action}
              </span>
              {typeof e.metadata?.name === "string" && (
                <span className="text-slate-500 dark:text-slate-400"> · {e.metadata.name}</span>
              )}
              {typeof e.metadata?.email === "string" && (
                <span className="text-slate-500 dark:text-slate-400"> · {e.metadata.email}</span>
              )}
              {typeof e.metadata?.filename === "string" && (
                <span className="text-slate-500 dark:text-slate-400"> · {e.metadata.filename}</span>
              )}
              <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                {formatRelativeTime(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
