"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { isDotenvStyleFile } from "@/lib/schemas";
import { RequireAuth } from "@/components/require-auth";
import { RequireVaultUnlocked } from "@/components/require-vault-unlocked";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { VersionHistoryDialog } from "@/components/version-history-dialog";
import { useProject } from "@/hooks/use-projects";
import { useProjectKey } from "@/hooks/use-project-key";
import { useDeleteFile, useFiles, useUploadFile, downloadFileVersion } from "@/hooks/use-files";
import { decryptFile } from "@/lib/vault-client";
import { downloadBlob } from "@/lib/download";
import { buildZip } from "@/lib/zip";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { toastError, useToastStore } from "@/lib/toast-store";
import { apiRequest } from "@/lib/api-client";
import type { FileDto } from "@/lib/types";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <AppShell>
        <RequireVaultUnlocked>
          <ProjectDetail projectId={params.id} />
        </RequireVaultUnlocked>
      </AppShell>
    </RequireAuth>
  );
}

function ProjectDetail({ projectId }: { projectId: string }) {
  const { data: project, isLoading: loadingProject } = useProject(projectId);
  const { projectKey, error: keyError } = useProjectKey(project);
  const { data: files, isLoading: loadingFiles } = useFiles(projectId);
  const [historyFile, setHistoryFile] = useState<FileDto | null>(null);

  if (loadingProject) return <p className="text-sm text-slate-500">Loading project…</p>;
  if (!project) return <p className="text-sm text-red-600">Project not found.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
          ← Projects
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{project.name}</h1>
        {project.gitRemoteUrl && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{project.gitRemoteUrl}</p>
        )}
      </div>

      {keyError && (
        <Card className="border-red-300 p-4 text-sm text-red-700 dark:border-red-800 dark:text-red-300">
          Couldn&apos;t decrypt this project&apos;s key with your current vault passphrase.
        </Card>
      )}

      {projectKey && (
        <>
          <UploadCard projectId={projectId} projectKey={projectKey} />
          <FilesCard
            projectId={projectId}
            project={project}
            files={files ?? []}
            loading={loadingFiles}
            projectKey={projectKey}
            onShowHistory={setHistoryFile}
          />
        </>
      )}

      {historyFile && projectKey && (
        <VersionHistoryDialog
          open={!!historyFile}
          onOpenChange={(open) => !open && setHistoryFile(null)}
          projectId={projectId}
          file={historyFile}
          projectKey={projectKey}
        />
      )}
    </div>
  );
}

function UploadCard({ projectId, projectKey }: { projectId: string; projectKey: Uint8Array }) {
  const uploadFile = useUploadFile(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = filename.trim() || file.name;
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      await uploadFile.mutateAsync({ filename: name, plaintext: buffer, projectKey });
      useToastStore.getState().push("success", `Uploaded ${name}`);
      setFilename("");
    } catch (err) {
      toastError(err, "Failed to upload file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader
        title="Upload a file"
        description="Encrypted in your browser before it ever leaves this device — EnvVault never sees plaintext contents."
      />
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Override filename (optional)
          </label>
          <input
            className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="defaults to the selected file's name"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          loading={uploadFile.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          Choose file…
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>
    </Card>
  );
}

function FilesCard({
  projectId,
  project,
  files,
  loading,
  projectKey,
  onShowHistory,
}: {
  projectId: string;
  project: import("@/lib/types").ProjectDto;
  files: FileDto[];
  loading: boolean;
  projectKey: Uint8Array;
  onShowHistory: (file: FileDto) => void;
}) {
  const deleteFile = useDeleteFile(projectId);
  const [pendingDelete, setPendingDelete] = useState<FileDto | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  async function handleDownload(file: FileDto) {
    if (!file.currentVersion) return;
    try {
      const downloaded = await downloadFileVersion(projectId, file.id, file.currentVersion.id);
      const plaintext = await decryptFile(projectKey, downloaded.payload);
      downloadBlob(file.filename, plaintext, "text/plain");
    } catch (err) {
      toastError(err, "Failed to download file");
    }
  }

  async function handleDownloadAll() {
    setDownloadingAll(true);
    try {
      const { files: exported } = await apiRequest<{
        files: Array<{ filename: string; payload: { iv: string; ciphertext: string; contentId: string } }>;
      }>(`/projects/${projectId}/files/export`);
      const entries = await Promise.all(
        exported.map(async (f) => ({ name: f.filename, data: await decryptFile(projectKey, f.payload) })),
      );
      const zip = buildZip(entries);
      downloadBlob(`${project.name}.zip`, zip, "application/zip");
    } catch (err) {
      toastError(err, "Failed to build ZIP archive");
    } finally {
      setDownloadingAll(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteFile.mutateAsync(pendingDelete.id);
      useToastStore.getState().push("success", `Deleted ${pendingDelete.filename}`);
    } catch (err) {
      toastError(err, "Failed to delete file");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Files"
        description={`${files.length} file${files.length === 1 ? "" : "s"}`}
        action={
          files.length > 0 && (
            <Button variant="secondary" loading={downloadingAll} onClick={handleDownloadAll}>
              Download all (.zip)
            </Button>
          )
        }
      />
      {loading && <p className="p-5 text-sm text-slate-500">Loading files…</p>}
      {!loading && files.length === 0 && (
        <p className="p-5 text-sm text-slate-500 dark:text-slate-400">
          No files yet. Upload your first environment file above.
        </p>
      )}
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-sm text-slate-900 dark:text-slate-100">{file.filename}</span>
                {isDotenvStyleFile(file.filename) && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    env
                  </span>
                )}
              </div>
              {file.currentVersion && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  v{file.currentVersion.versionNumber} · {formatBytes(file.currentVersion.plaintextSize)} ·
                  updated {formatRelativeTime(file.currentVersion.createdAt)}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="secondary" onClick={() => handleDownload(file)}>
                Download
              </Button>
              <Button variant="secondary" onClick={() => onShowHistory(file)}>
                History
              </Button>
              <Button variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => setPendingDelete(file)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent
          title={`Delete "${pendingDelete?.filename}"?`}
          description="This permanently deletes the file and all of its version history. This cannot be undone."
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button variant="danger" loading={deleteFile.isPending} onClick={handleDelete}>
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
