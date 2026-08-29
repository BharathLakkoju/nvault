"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  useDeleteOrganization,
  useOrganization,
  useRenameOrganization,
  useStartOrgCheckout,
} from "@/hooks/use-organizations";
import { useOrgContext } from "@/lib/org-context-store";
import { formatRelativeTime } from "@/lib/format";
import { toastError, useToastStore } from "@/lib/toast-store";
import type { OrgRole } from "@/lib/types";

const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export default function OrganizationPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <AppShell>
        <OrganizationContent id={id} />
      </AppShell>
    </RequireAuth>
  );
}

function OrganizationContent({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useOrganization(id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const setCurrentOrg = useOrgContext((s) => s.setCurrentOrg);

  const justPaid = searchParams.get("welcome") === "1";
  const orgStatus = data?.organization.orgStatus;

  // After returning from Polar checkout the webhook may not have landed yet —
  // poll until the org flips to ACTIVE.
  useEffect(() => {
    if (!justPaid || orgStatus === "ACTIVE") return;
    const timer = setInterval(() => void refetch(), 3000);
    return () => clearInterval(timer);
  }, [justPaid, orgStatus, refetch]);

  useEffect(() => {
    if (justPaid && orgStatus === "ACTIVE") {
      useToastStore.getState().push("success", "Organization activated — you're all set.");
    }
  }, [justPaid, orgStatus]);

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (error || !data) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-muted">
          Organization not found, or you don&apos;t have access to it.
        </p>
        <Link href="/settings/organizations" className="mt-3 inline-block text-sm text-accent-600 hover:underline">
          Back to organizations
        </Link>
      </Card>
    );
  }

  const { organization: org, self, members } = data;
  const isAdmin = self.role === "ADMIN" || self.role === "OWNER";
  const isOwner = self.role === "OWNER";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[28px]">{org.name}</h1>
          <p className="text-sm text-muted">
            /{org.slug} · you are {ROLE_LABEL[self.role].toLowerCase()}
            {self.status === "INVITED" && " · awaiting key access from an admin"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setCurrentOrg(org.id);
              router.push("/dashboard");
            }}
          >
            View projects
          </Button>
          <Link href={`/organizations/${id}/members`}>
            <Button variant="secondary">Members</Button>
          </Link>
          {isAdmin && (
            <Link href={`/organizations/${id}/activity`}>
              <Button variant="secondary">Activity</Button>
            </Link>
          )}
          {isOwner && (
            <Link href={`/organizations/${id}/billing`}>
              <Button variant="secondary">Billing</Button>
            </Link>
          )}
          {isAdmin && <RenameOrgDialog id={id} name={org.name} slug={org.slug} />}
        </div>
      </div>

      {org.orgStatus !== "ACTIVE" && (
        <OrgBillingBanner id={id} status={org.orgStatus} isOwner={isOwner} />
      )}

      {self.status === "INVITED" && (
        <Card className="border-amber-500/40">
          <div className="p-5 text-sm text-ink/70">
            You&apos;ve joined this organization, but an admin still needs to grant you access to its
            encryption key before you can open its projects.
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title={`${members.length} member${members.length === 1 ? "" : "s"}`}
          description="Everyone with access to this organization's projects."
          action={
            <Link href={`/organizations/${id}/members`}>
              <Button variant="secondary">Manage members</Button>
            </Link>
          }
        />
        <ul className="divide-y divide-line">
          {members.slice(0, 6).map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">
                  {m.name || m.email}
                </div>
                <p className="text-xs text-muted">
                  {m.email} · joined {formatRelativeTime(m.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {m.status === "INVITED" && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    no key yet
                  </span>
                )}
                <span className="rounded-md bg-ink/[0.08] px-2 py-0.5 text-xs font-medium text-ink/80">
                  {ROLE_LABEL[m.role]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {isOwner && (
        <Card className="border-red-500/30">
          <CardHeader title="Danger zone" description="Irreversible actions for this organization." />
          <div className="px-5 py-4">
            <DeleteOrgButton
              id={id}
              name={org.name}
              projectCount={org.projectCount}
              onDeleted={() => {
                setCurrentOrg(null);
                router.push("/settings/organizations");
              }}
            />
          </div>
        </Card>
      )}
    </div>
  );
}

function OrgBillingBanner({
  id,
  status,
  isOwner,
}: {
  id: string;
  status: "PENDING_PAYMENT" | "SUSPENDED";
  isOwner: boolean;
}) {
  const checkout = useStartOrgCheckout(id);

  async function goToCheckout() {
    try {
      const { url } = await checkout.mutateAsync(undefined);
      window.location.href = url;
    } catch (err) {
      toastError(err, "Could not open checkout");
    }
  }

  const pending = status === "PENDING_PAYMENT";
  const headline = pending
    ? "This organization isn't active yet"
    : "This organization's subscription is inactive";
  const body = pending
    ? "Complete payment to activate the organization. Until then, its projects and members are locked."
    : "Payment for this organization has lapsed. Projects are read-only until the subscription is renewed.";

  return (
    <Card
      className={
        pending
          ? "border-amber-500/40"
          : "border-red-500/40"
      }
    >
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-ink">{headline}</div>
          <p className="mt-1 text-sm text-ink/70">{body}</p>
        </div>
        {isOwner ? (
          <Button onClick={goToCheckout} loading={checkout.isPending} className="shrink-0">
            {pending ? "Complete payment" : "Renew subscription"}
          </Button>
        ) : (
          <p className="shrink-0 text-xs text-muted">
            Ask the organization owner to {pending ? "complete payment" : "renew the subscription"}.
          </p>
        )}
      </div>
    </Card>
  );
}

function RenameOrgDialog({ id, name, slug }: { id: string; name: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [nextName, setNextName] = useState(name);
  const [nextSlug, setNextSlug] = useState(slug);
  const [error, setError] = useState<string | null>(null);
  const rename = useRenameOrganization(id);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await rename.mutateAsync({ name: nextName.trim(), slug: nextSlug.trim().toLowerCase() });
      useToastStore.getState().push("success", "Organization updated");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update organization");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Settings</Button>
      </DialogTrigger>
      <DialogContent title="Organization settings">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="rename-name">Name</Label>
            <Input id="rename-name" value={nextName} maxLength={100} onChange={(e) => setNextName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rename-slug">URL</Label>
            <Input
              id="rename-slug"
              value={nextSlug}
              maxLength={40}
              onChange={(e) => setNextSlug(e.target.value.toLowerCase())}
            />
            <FieldError>{error}</FieldError>
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={rename.isPending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteOrgButton({
  id,
  name,
  projectCount,
  onDeleted,
}: {
  id: string;
  name: string;
  projectCount: number;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const del = useDeleteOrganization();

  async function handleDelete() {
    try {
      await del.mutateAsync(id);
      useToastStore.getState().push("success", `Organization "${name}" deleted`);
      onDeleted();
    } catch (err) {
      toastError(err, "Failed to delete organization");
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger">Delete organization</Button>
      </DialogTrigger>
      <DialogContent
        title={`Delete "${name}"?`}
        description={
          projectCount > 0
            ? `This organization still has ${projectCount} project${projectCount === 1 ? "" : "s"}. Delete or move them first.`
            : "This removes the organization and every membership. This cannot be undone."
        }
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={del.isPending}
            disabled={projectCount > 0}
            onClick={handleDelete}
          >
            Delete permanently
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
