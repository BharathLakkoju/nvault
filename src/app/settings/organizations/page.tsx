"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { RequireVaultUnlocked } from "@/components/require-vault-unlocked";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useCreateOrganization, useOrganizations } from "@/hooks/use-organizations";
import { useOrgContext } from "@/lib/org-context-store";
import { toastError, useToastStore } from "@/lib/toast-store";

export default function OrganizationsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <RequireVaultUnlocked>
          <OrganizationsContent />
        </RequireVaultUnlocked>
      </AppShell>
    </RequireAuth>
  );
}

function OrganizationsContent() {
  const { data: orgs, isLoading } = useOrganizations();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Organizations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Share projects and environment files with a team.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">+ New organization</Button>
          </DialogTrigger>
          <DialogContent
            title="Create an organization"
            description="A fresh encryption key is generated in your browser and never leaves it unwrapped."
          >
            <CreateOrgForm onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader title="Your organizations" description="Organizations you own or belong to." />
        {isLoading && <p className="p-5 text-sm text-slate-500">Loading…</p>}
        {!isLoading && (orgs?.length ?? 0) === 0 && (
          <p className="p-5 text-sm text-slate-500 dark:text-slate-400">
            You&apos;re not in any organization yet. Create one to invite teammates.
          </p>
        )}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {orgs?.map((org) => (
            <li
              key={org.id}
              className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <Link
                  href={`/organizations/${org.id}`}
                  className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100"
                >
                  {org.name}
                </Link>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  /{org.slug} · {org.role?.toLowerCase()} ·{" "}
                  {org.memberCount ?? 0} member{org.memberCount === 1 ? "" : "s"} ·{" "}
                  {org.projectCount ?? 0} project{org.projectCount === 1 ? "" : "s"}
                  {org.status === "INVITED" && " · awaiting key access"}
                </p>
              </div>
              <Link href={`/organizations/${org.id}`}>
                <Button variant="secondary">Manage</Button>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function CreateOrgForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateOrganization();
  const setCurrentOrg = useOrgContext((s) => s.setCurrentOrg);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const org = await create.mutateAsync({ name: name.trim(), slug: effectiveSlug });
      useToastStore.getState().push("success", `Organization "${org.name}" created`);
      setCurrentOrg(org.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
      toastError(err, "Failed to create organization");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="org-name">Name</Label>
        <Input
          id="org-name"
          autoFocus
          required
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Inc"
        />
      </div>
      <div>
        <Label htmlFor="org-slug">URL</Label>
        <Input
          id="org-slug"
          required
          value={effectiveSlug}
          maxLength={40}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          placeholder="acme"
        />
        <FieldError>{error}</FieldError>
      </div>
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" loading={create.isPending}>
          Create
        </Button>
      </div>
    </form>
  );
}
