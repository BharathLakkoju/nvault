"use client";

import { useEffect, useState } from "react";
import { GitBranch, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/input";
import { useUpdateProject } from "@/hooks/use-projects";
import { toastError, useToastStore } from "@/lib/toast-store";
import type { ProjectDto } from "@/lib/types";

export function GitRemoteCard({ project }: { project: ProjectDto }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(project.gitRemoteUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const updateProject = useUpdateProject();

  useEffect(() => {
    if (!editing) setUrl(project.gitRemoteUrl ?? "");
  }, [project.gitRemoteUrl, editing]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    try {
      await updateProject.mutateAsync({
        id: project.id,
        gitRemoteUrl: trimmed === "" ? null : trimmed,
      });
      useToastStore.getState().push("success", trimmed ? "Git repository linked" : "Git repository unlinked");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update git repository");
    }
  }

  async function handleUnlink() {
    setError(null);
    try {
      await updateProject.mutateAsync({ id: project.id, gitRemoteUrl: null });
      useToastStore.getState().push("success", "Git repository unlinked");
      setEditing(false);
    } catch (err) {
      toastError(err, "Failed to unlink git repository");
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader
        kicker="CLI"
        title="Git repository"
        description="Link the Git remote for this codebase so `nvault init`, `nvault pull`, and `nvault status` can auto-detect this project from your checkout."
        action={
          !editing && (
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              {project.gitRemoteUrl ? "Edit" : "Link repository"}
            </Button>
          )
        }
      />
      <div className="px-5 py-4">
        {!editing && project.gitRemoteUrl && (
          <div className="flex items-start gap-2 text-sm text-ink">
            <GitBranch size={16} className="mt-0.5 shrink-0 text-muted" />
            <span className="break-all">{project.gitRemoteUrl}</span>
          </div>
        )}
        {!editing && !project.gitRemoteUrl && (
          <p className="text-sm text-muted">
            No repository linked yet. Paste your GitHub remote (HTTPS or SSH) after uploading files here.
          </p>
        )}
        {editing && (
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label htmlFor="git-remote-url">Repository URL</Label>
              <Input
                id="git-remote-url"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/you/your-app.git"
              />
              <p className="mt-1.5 text-xs text-muted">
                SSH and HTTPS remotes are both accepted. Example:{" "}
                <span className="font-mono">git@github.com:you/your-app.git</span>
              </p>
              <FieldError>{error}</FieldError>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={updateProject.isPending}>
                <Link2 size={14} />
                Save link
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              {project.gitRemoteUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-danger"
                  disabled={updateProject.isPending}
                  onClick={handleUnlink}
                >
                  <Unlink size={14} />
                  Unlink
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
