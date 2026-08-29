"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileLock,
  Eye,
  EyeSlash,
  Copy,
  DownloadSimple,
  UploadSimple,
  CaretDown,
  CaretUp,
  Trash,
} from "@phosphor-icons/react";
import { isDotenvStyleFile } from "@/lib/schemas";
import { RequireAuth } from "@/components/require-auth";
import { RequireVaultUnlocked } from "@/components/require-vault-unlocked";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Dialog, DialogContent, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useProject } from "@/hooks/use-projects";
import { useProjectKey } from "@/hooks/use-project-key";
import {
  useDeleteFile,
  useFiles,
  useFileVersions,
  useRestoreVersion,
  useUploadFile,
  downloadFileVersion,
} from "@/hooks/use-files";
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

  if (loadingProject) return <p className="text-sm text-muted">Loading project…</p>;
  if (!project) return <p className="text-sm text-red-600 dark:text-red-400">Project not found.</p>;

  const fileList = files ?? [];

  return (
    <div>
      <div className="mb-2.5 text-[13px] text-muted">
        <Link href="/dashboard" className="hover:text-accent-600 dark:hover:text-accent-300">
          Projects
        </Link>{" "}
        / <span className="text-ink/70">{project.name}</span>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[26px]">{project.name}</h1>
          <p className="mt-0.5 text-muted">
            {fileList.length} environment file{fileList.length === 1 ? "" : "s"} · zero-knowledge encrypted
          </p>
          {project.gitRemoteUrl && <p className="mt-0.5 text-xs text-muted/70">{project.gitRemoteUrl}</p>}
        </div>
        {projectKey && (
          <div className="flex gap-2">
            {fileList.length > 0 && (
              <DownloadAllButton projectId={projectId} projectName={project.name} projectKey={projectKey} />
            )}
            <UploadDialog projectId={projectId} projectKey={projectKey} />
          </div>
        )}
      </div>

      {keyError && (
        <Card className="border-red-500/40 p-4 text-sm text-red-700 dark:text-red-300">
          Couldn&apos;t decrypt this project&apos;s key with your current vault passphrase.
        </Card>
      )}

      {projectKey && (
        <div className="flex flex-col gap-2.5">
          {loadingFiles && <p className="text-sm text-muted">Loading files…</p>}
          {!loadingFiles && fileList.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted">
              No files yet. Upload your first environment file.
            </Card>
          )}
          {fileList.map((file) => (
            <FileRow key={file.id} projectId={projectId} file={file} projectKey={projectKey} />
          ))}
        </div>
      )}
    </div>
  );
}

function UploadDialog({ projectId, projectKey }: { projectId: string; projectKey: Uint8Array }) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
    } catch (err) {
      toastError(err, "Failed to upload file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UploadSimple size={15} />
          Upload file
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Upload a file"
        description="Encrypted in your browser before it ever leaves this device — nvault never sees plaintext contents."
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="upload-name">Override filename (optional)</Label>
            <Input
              id="upload-name"
              placeholder="defaults to the selected file's name"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button loading={uploadFile.isPending} onClick={() => fileInputRef.current?.click()}>
              Choose file…
            </Button>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DownloadAllButton({
  projectId,
  projectName,
  projectKey,
}: {
  projectId: string;
  projectName: string;
  projectKey: Uint8Array;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDownloadAll() {
    setBusy(true);
    try {
      const { files: exported } = await apiRequest<{
        files: Array<{ filename: string; payload: { iv: string; ciphertext: string; contentId: string } }>;
      }>(`/projects/${projectId}/files/export`);
      const entries = await Promise.all(
        exported.map(async (f) => ({ name: f.filename, data: await decryptFile(projectKey, f.payload) })),
      );
      downloadBlob(`${projectName}.zip`, buildZip(entries), "application/zip");
    } catch (err) {
      toastError(err, "Failed to build ZIP archive");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" loading={busy} onClick={handleDownloadAll}>
      <DownloadSimple size={15} />
      Download all (.zip)
    </Button>
  );
}

function FileRow({
  projectId,
  file,
  projectKey,
}: {
  projectId: string;
  file: FileDto;
  projectKey: Uint8Array;
}) {
  const deleteFile = useDeleteFile(projectId);
  const [revealed, setRevealed] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  async function loadPlaintext(): Promise<string | null> {
    if (content !== null) return content;
    if (!file.currentVersion) return null;
    try {
      const downloaded = await downloadFileVersion(projectId, file.id, file.currentVersion.id);
      const bytes = await decryptFile(projectKey, downloaded.payload);
      const text = new TextDecoder().decode(bytes);
      setContent(text);
      return text;
    } catch (err) {
      toastError(err, "Failed to decrypt file");
      return null;
    }
  }

  async function toggleReveal() {
    if (revealed) {
      setRevealed(false);
      return;
    }
    const text = await loadPlaintext();
    if (text !== null) setRevealed(true);
  }

  async function handleCopy() {
    const text = await loadPlaintext();
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
      useToastStore.getState().push("success", `Copied ${file.filename} — clear your clipboard when done`);
    } catch {
      toastError(new Error("Clipboard unavailable"), "Couldn't copy");
    }
  }

  async function handleDownload() {
    const text = await loadPlaintext();
    if (text === null) return;
    downloadBlob(file.filename, new TextEncoder().encode(text), "text/plain");
  }

  async function handleDelete() {
    try {
      await deleteFile.mutateAsync(file.id);
      useToastStore.getState().push("success", `Deleted ${file.filename}`);
    } catch (err) {
      toastError(err, "Failed to delete file");
    } finally {
      setPendingDelete(false);
    }
  }

  const v = file.currentVersion;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <FileLock size={18} className="flex-shrink-0 text-accent-600 dark:text-accent-300" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{file.filename}</span>
            {isDotenvStyleFile(file.filename) && <Tag variant="neutral">env</Tag>}
          </div>
          {v && (
            <div className="text-xs text-muted">
              {formatBytes(v.plaintextSize)} · updated {formatRelativeTime(v.createdAt)} · v{v.versionNumber}
            </div>
          )}
        </div>
        <RowIcon label={revealed ? "Hide" : "Reveal"} onClick={toggleReveal}>
          {revealed ? <EyeSlash size={16} /> : <Eye size={16} />}
        </RowIcon>
        <RowIcon label="Copy" onClick={handleCopy}>
          <Copy size={16} />
        </RowIcon>
        <RowIcon label="Download" onClick={handleDownload}>
          <DownloadSimple size={16} />
        </RowIcon>
        <RowIcon label="Version history" onClick={() => setExpanded((e) => !e)}>
          {expanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
        </RowIcon>
        <RowIcon label="Delete" onClick={() => setPendingDelete(true)}>
          <Trash size={16} className="text-red-600 dark:text-red-400" />
        </RowIcon>
      </div>

      {revealed && content !== null && (
        <div className="px-4 pb-4 pl-12">
          <pre className="dc-scroll m-0 overflow-x-auto rounded-md border border-line bg-surface-3 px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-accent-700 dark:text-accent-100">
            {content}
          </pre>
        </div>
      )}

      {expanded && (
        <VersionHistory projectId={projectId} file={file} projectKey={projectKey} />
      )}

      <Dialog open={pendingDelete} onOpenChange={setPendingDelete}>
        <DialogContent
          title={`Delete "${file.filename}"?`}
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

function RowIcon({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="focus-ring inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06] hover:text-ink"
    >
      {children}
    </button>
  );
}

function VersionHistory({
  projectId,
  file,
  projectKey,
}: {
  projectId: string;
  file: FileDto;
  projectKey: Uint8Array;
}) {
  const { data: versions, isLoading } = useFileVersions(projectId, file.id);
  const restore = useRestoreVersion(projectId, file.id);

  async function handleDownload(versionId: string, versionNumber: number) {
    try {
      const downloaded = await downloadFileVersion(projectId, file.id, versionId);
      const plaintext = await decryptFile(projectKey, downloaded.payload);
      downloadBlob(`${file.filename}.v${versionNumber}`, plaintext, "text/plain");
    } catch (err) {
      toastError(err, "Failed to download version");
    }
  }

  async function handleRestore(versionId: string, versionNumber: number) {
    try {
      await restore.mutateAsync(versionId);
      useToastStore.getState().push("success", `Restored v${versionNumber} as the new current version`);
    } catch (err) {
      toastError(err, "Failed to restore version");
    }
  }

  return (
    <div className="border-t border-line px-4 py-3 pl-12">
      <div className="mb-2 text-[11px] uppercase tracking-[0.06em] text-muted">Version history</div>
      {isLoading && <p className="text-xs text-muted">Loading…</p>}
      <div className="flex flex-col">
        {versions?.map((ver) => (
          <div key={ver.id} className="flex items-center gap-3 py-1.5 text-[13px]">
            <span className="w-9 font-mono text-accent-600 dark:text-accent-300">v{ver.versionNumber}</span>
            <span className="flex-1 text-ink/70">
              {formatRelativeTime(ver.createdAt)} · {formatBytes(ver.plaintextSize)}
            </span>
            {ver.isCurrent ? (
              <Tag variant="neutral">current</Tag>
            ) : (
              <>
                <button
                  onClick={() => handleDownload(ver.id, ver.versionNumber)}
                  className="focus-ring rounded px-1.5 py-0.5 text-xs text-accent-600 hover:bg-accent-500/10 dark:text-accent-300"
                >
                  Download
                </button>
                <button
                  onClick={() => handleRestore(ver.id, ver.versionNumber)}
                  className="focus-ring rounded px-1.5 py-0.5 text-xs text-accent-600 hover:bg-accent-500/10 dark:text-accent-300"
                >
                  Restore
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
