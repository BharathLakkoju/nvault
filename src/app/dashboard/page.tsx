"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderSimple, LockKey, ShieldCheck, Plus } from "@phosphor-icons/react";
import { RequireAuth } from "@/components/require-auth";
import { RequireVaultUnlocked } from "@/components/require-vault-unlocked";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card, StatCard } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useCreateProject, useDeleteProject, useProjects } from "@/hooks/use-projects";
import { useOrganizations } from "@/hooks/use-organizations";
import { usePlanInfo } from "@/hooks/use-plan-info";
import { useProSubscription } from "@/hooks/use-billing";
import { useOrgContext } from "@/lib/org-context-store";
import { formatRelativeTime } from "@/lib/format";
import { toastError, useToastStore } from "@/lib/toast-store";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <AppShell>
        <RequireVaultUnlocked>
          <DashboardContent />
        </RequireVaultUnlocked>
      </AppShell>
    </RequireAuth>
  );
}

function DashboardContent() {
  const { data: projects, isLoading } = useProjects();
  const { data: orgs } = useOrganizations();
  const { data: plan } = usePlanInfo();
  const { data: billing } = useProSubscription();
  const currentOrgId = useOrgContext((s) => s.currentOrgId);

  const isProPlan = billing?.pro.status === "ACTIVE" || billing?.pro.status === "PAST_DUE";
  const [open, setOpen] = useState(false);

  const currentOrg = orgs?.find((o) => o.id === currentOrgId) ?? null;
  const canCreateHere = !currentOrg || currentOrg.role === "ADMIN" || currentOrg.role === "OWNER";
  const scoped = (projects ?? []).filter((p) =>
    currentOrgId ? p.organizationId === currentOrgId : p.scope === "personal",
  );
  const fileCount = scoped.reduce((n, p) => n + (p.fileCount ?? 0), 0);

  // Free-tier personal-project cap (only relevant outside an org).
  const personalCount = (projects ?? []).filter((p) => p.scope === "personal").length;
  const personalCap = plan?.freeMaxPersonalProjects ?? Infinity;
  const atPersonalCap = !currentOrg && personalCount >= personalCap;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[28px]">
            {currentOrg ? `${currentOrg.name} · Projects` : "Projects"}
          </h1>
          <p className="mt-0.5 text-muted">
            {currentOrg
              ? "Shared across everyone in this organization."
              : "Your development environment, available anywhere."}
          </p>
        </div>
        {canCreateHere && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" disabled={atPersonalCap}>
                <Plus size={15} />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent
              title={currentOrg ? `New project in ${currentOrg.name}` : "Create project"}
              description="Give your project a name to get started."
            >
              <CreateProjectForm organizationId={currentOrgId} onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3">
        <ShieldCheck size={18} weight="fill" className="flex-shrink-0 text-accent-600 dark:text-accent-400" />
        <span className="text-[13px] text-ink/80">
          Every file is encrypted in your browser before it ever leaves your machine — nvault&apos;s servers only
          ever see ciphertext.
        </span>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <StatCard kicker="Projects" value={scoped.length} />
        <StatCard kicker="Encrypted files" value={fileCount} />
        <StatCard
          kicker="Plan"
          value={<span className="text-lg">{isProPlan ? "Pro" : "Free — beta"}</span>}
        />
      </div>

      {atPersonalCap && (
        <Card className="mb-4 flex flex-col gap-3 border-amber-500/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/70">
            You&apos;ve reached the Free plan limit of {personalCap} personal projects.
            {plan?.billingEnabled
              ? " Upgrade to Pro for unlimited, or "
              : " Delete a project to free up a slot, or "}
            create an{" "}
            <Link href="/settings/organizations" className="text-accent-600 hover:underline dark:text-accent-300">
              organization
            </Link>{" "}
            for your team.
          </p>
          {plan?.billingEnabled && (
            <Link href="/settings/billing" className="shrink-0">
              <Button variant="secondary">Upgrade to Pro</Button>
            </Link>
          )}
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted">Loading projects…</p>}

      {!isLoading && scoped.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted">
            {currentOrg
              ? canCreateHere
                ? "No projects in this organization yet. Create one to start sharing environment files."
                : "No projects in this organization yet."
              : "No projects yet. Create one to start storing environment files."}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scoped.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}

function CreateProjectForm({
  onDone,
  organizationId,
}: {
  onDone: () => void;
  organizationId?: string | null;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createProject = useCreateProject();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createProject.mutateAsync({ name, organizationId });
      useToastStore.getState().push("success", `Project "${name}" created`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="project-name">Project name</Label>
        <Input id="project-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} />
        <FieldError>{error}</FieldError>
      </div>
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" loading={createProject.isPending}>
          Create
        </Button>
      </div>
    </form>
  );
}

function ProjectCard({ project }: { project: import("@/lib/types").ProjectDto }) {
  const router = useRouter();
  const deleteProject = useDeleteProject();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    try {
      await deleteProject.mutateAsync(project.id);
      useToastStore.getState().push("success", `Project "${project.name}" deleted`);
    } catch (err) {
      toastError(err, "Failed to delete project");
    } finally {
      setConfirmOpen(false);
    }
  }

  return (
    <Card className="flex h-full cursor-pointer flex-col gap-2 p-4 transition-colors hover:border-accent-500/40">
      <div
        onClick={() => router.push(`/projects/${project.id}`)}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center justify-between">
          <FolderSimple size={20} className="text-accent-600 dark:text-accent-300" />
          <Tag variant="outline">
            <LockKey size={11} />
            encrypted
          </Tag>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{project.name}</span>
          {project.scope === "org" && project.organizationName && (
            <Tag variant="neutral">{project.organizationName}</Tag>
          )}
        </div>
        <p className="text-xs text-muted">
          {project.fileCount ?? 0} environment file{project.fileCount === 1 ? "" : "s"} · Updated{" "}
          {formatRelativeTime(project.updatedAt)}
        </p>
        {project.gitRemoteUrl && (
          <p className="truncate text-xs text-muted/70">{project.gitRemoteUrl}</p>
        )}
      </div>

      <div className="mt-auto flex gap-2 pt-1.5">
        <Link href={`/projects/${project.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" className="w-full">
            View
          </Button>
        </Link>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button
              variant="secondary"
              className="text-red-600 dark:text-red-400"
              onClick={(e) => e.stopPropagation()}
            >
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent
            title={`Delete "${project.name}"?`}
            description="This permanently deletes the project and every version of every file in it. This cannot be undone."
          >
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button variant="danger" loading={deleteProject.isPending} onClick={handleDelete}>
                Delete permanently
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
