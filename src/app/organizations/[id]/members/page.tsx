"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { RequireVaultUnlocked } from "@/components/require-vault-unlocked";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useOrganization } from "@/hooks/use-organizations";
import {
  useChangeMemberRole,
  useCreateInvite,
  useGrantKey,
  useOrgInvites,
  useRemoveMember,
  useRevokeInvite,
  useTransferOwnership,
} from "@/hooks/use-org-members";
import { useOrgContext } from "@/lib/org-context-store";
import { formatRelativeTime } from "@/lib/format";
import { toastError, useToastStore } from "@/lib/toast-store";
import type { OrgMemberDto, OrgRole } from "@/lib/types";

const ROLES: OrgRole[] = ["MEMBER", "ADMIN", "OWNER"];
const RANK: Record<OrgRole, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

export default function OrgMembersPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <AppShell>
        <RequireVaultUnlocked>
          <MembersContent id={id} />
        </RequireVaultUnlocked>
      </AppShell>
    </RequireAuth>
  );
}

function MembersContent({ id }: { id: string }) {
  const { data, isLoading, error } = useOrganization(id);
  const isAdmin = data?.self.role === "ADMIN" || data?.self.role === "OWNER";
  const { data: invites } = useOrgInvites(id, !!isAdmin);

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error || !data) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Organization not found, or you don&apos;t have access.
        </p>
      </Card>
    );
  }

  const { organization: org, self, members } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/organizations/${id}`} className="text-sm text-accent-600 hover:underline">
          ← {org.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Members</h1>
      </div>

      {isAdmin && <InviteCard orgId={id} selfRole={self.role} />}

      {isAdmin && invites && invites.length > 0 && (
        <Card>
          <CardHeader title="Pending invitations" />
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {inv.email}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {inv.role.toLowerCase()} · expires {formatRelativeTime(inv.expiresAt)}
                  </p>
                </div>
                <RevokeInviteButton orgId={id} inviteId={inv.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title={`${members.length} member${members.length === 1 ? "" : "s"}`} />
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              orgId={id}
              member={m}
              self={self}
              currentKeyEpoch={org.currentKeyEpoch}
            />
          ))}
        </ul>
      </Card>

      {self.role !== "OWNER" && (
        <LeaveOrgButton orgId={id} membershipId={self.membershipId} orgName={org.name} />
      )}
    </div>
  );
}

function InviteCard({ orgId, selfRole }: { orgId: string; selfRole: OrgRole }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const create = useCreateInvite(orgId);

  // You can only invite at a role strictly below your own (OWNER can invite anyone).
  const assignable = selfRole === "OWNER" ? ROLES : ROLES.filter((r) => RANK[r] < RANK[selfRole]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await create.mutateAsync({ email: email.trim().toLowerCase(), role });
      setLink(`${window.location.origin}/invite/${res.token}`);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invitation");
    }
  }

  return (
    <Card>
      <CardHeader
        title="Invite a teammate"
        description="Generates a one-time link. Share it directly with the person you're inviting."
      />
      <form onSubmit={submit} className="space-y-3 p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>
          <div className="sm:w-40">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" loading={create.isPending}>
          Create invitation
        </Button>
      </form>

      {link && (
        <div className="space-y-2 border-t border-slate-200 p-5 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Invitation link — copy it now, it won&apos;t be shown again
          </p>
          <code className="block overflow-x-auto rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-900 dark:bg-slate-800 dark:text-slate-100">
            {link}
          </code>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(link)
                  .then(() => useToastStore.getState().push("success", "Copied"))
                  .catch(() => undefined)
              }
            >
              Copy link
            </Button>
            <Button variant="ghost" onClick={() => setLink(null)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function RevokeInviteButton({ orgId, inviteId }: { orgId: string; inviteId: string }) {
  const revoke = useRevokeInvite(orgId);
  return (
    <Button
      variant="ghost"
      className="text-red-600 dark:text-red-400"
      loading={revoke.isPending}
      onClick={() =>
        revoke
          .mutateAsync(inviteId)
          .then(() => useToastStore.getState().push("success", "Invitation revoked"))
          .catch((err) => toastError(err, "Failed to revoke"))
      }
    >
      Revoke
    </Button>
  );
}

function MemberRow({
  orgId,
  member,
  self,
  currentKeyEpoch,
}: {
  orgId: string;
  member: OrgMemberDto;
  self: { membershipId: string; role: OrgRole };
  currentKeyEpoch: number;
}) {
  const grant = useGrantKey(orgId);
  const changeRole = useChangeMemberRole(orgId);
  const remove = useRemoveMember(orgId);
  const transfer = useTransferOwnership(orgId);

  const isSelf = member.id === self.membershipId;
  const canManage =
    !isSelf && (self.role === "OWNER" || RANK[self.role] > RANK[member.role]);
  const canGrant = canManage && member.status !== "ACTIVE" && !!member.publicKey;
  const assignableRoles =
    self.role === "OWNER" ? ROLES : ROLES.filter((r) => RANK[r] < RANK[self.role]);

  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {member.name || member.email}
          {isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {member.email} · joined {formatRelativeTime(member.createdAt)}
          {member.status === "INVITED" && " · no key access yet"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canManage && member.role !== "OWNER" ? (
          <select
            value={member.role}
            disabled={changeRole.isPending}
            onChange={(e) =>
              changeRole
                .mutateAsync({ membershipId: member.id, role: e.target.value as OrgRole })
                .then(() => useToastStore.getState().push("success", "Role updated"))
                .catch((err) => toastError(err, "Failed to change role"))
            }
            className="focus-ring rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {assignableRoles.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
          </span>
        )}

        {canGrant && (
          <Button
            variant="secondary"
            loading={grant.isPending}
            onClick={() =>
              grant
                .mutateAsync({ membershipId: member.id, publicKey: member.publicKey! })
                .then(() => useToastStore.getState().push("success", "Key access granted"))
                .catch((err) => toastError(err, "Failed to grant key access"))
            }
          >
            Grant access
          </Button>
        )}

        {self.role === "OWNER" && !isSelf && member.status === "ACTIVE" && (
          <TransferButton
            onConfirm={() =>
              transfer
                .mutateAsync(member.id)
                .then(() => useToastStore.getState().push("success", "Ownership transferred"))
                .catch((err) => toastError(err, "Failed to transfer ownership"))
            }
            pending={transfer.isPending}
            email={member.email}
          />
        )}

        {canManage && (
          <Button
            variant="ghost"
            className="text-red-600 dark:text-red-400"
            loading={remove.isPending}
            onClick={() =>
              remove
                .mutateAsync(member.id)
                .then((r) => {
                  useToastStore
                    .getState()
                    .push(
                      "success",
                      r.rotationRequired
                        ? "Member removed — rotate the organization key soon"
                        : "Member removed",
                    );
                })
                .catch((err) => toastError(err, "Failed to remove member"))
            }
          >
            Remove
          </Button>
        )}
      </div>
    </li>
  );
}

function TransferButton({
  onConfirm,
  pending,
  email,
}: {
  onConfirm: () => void;
  pending: boolean;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">Make owner</Button>
      </DialogTrigger>
      <DialogContent
        title="Transfer ownership?"
        description={`${email} will become the owner and you will be demoted to admin. This takes effect immediately.`}
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={pending}
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            Transfer ownership
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeaveOrgButton({
  orgId,
  membershipId,
  orgName,
}: {
  orgId: string;
  membershipId: string;
  orgName: string;
}) {
  const [open, setOpen] = useState(false);
  const remove = useRemoveMember(orgId);
  const router = useRouter();
  const setCurrentOrg = useOrgContext((s) => s.setCurrentOrg);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger">Leave organization</Button>
      </DialogTrigger>
      <DialogContent
        title={`Leave "${orgName}"?`}
        description="You will lose access to all of this organization's projects. An admin would need to re-invite you."
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              remove
                .mutateAsync(membershipId)
                .then(() => {
                  useToastStore.getState().push("success", `Left ${orgName}`);
                  setCurrentOrg(null);
                  router.push("/settings/organizations");
                })
                .catch((err) => toastError(err, "Failed to leave"))
            }
          >
            Leave
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
