"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { RequireVaultUnlocked } from "@/components/require-vault-unlocked";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useCreateProject, useDeleteProject, useProjects } from "@/hooks/use-projects";
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
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Projects</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your development environment, available anywhere.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">+ New Project</Button>
          </DialogTrigger>
          <DialogContent title="Create project" description="Give your project a name to get started.">
            <CreateProjectForm onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading projects…</p>}

      {!isLoading && projects?.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No projects yet. Create one to start storing environment files.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {projects?.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}

function CreateProjectForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createProject = useCreateProject();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createProject.mutateAsync({ name });
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
    <Card className="flex flex-col justify-between p-5">
      <div>
        <Link href={`/projects/${project.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-100">
          {project.name}
        </Link>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {project.fileCount ?? 0} environment file{project.fileCount === 1 ? "" : "s"}
        </p>
        {project.gitRemoteUrl && (
          <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">{project.gitRemoteUrl}</p>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={`/projects/${project.id}`}>
          <Button variant="secondary">View</Button>
        </Link>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="text-red-600 dark:text-red-400">
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
