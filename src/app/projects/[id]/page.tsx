"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileLock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { isDotenvStyleFile } from "@/lib/schemas";
import { GitRemoteCard } from "@/components/git-remote-card";
import { RequireVaultUnlocked } from "@/components/require-vault-unlocked";
import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/spinner";
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

  if (loadingProject)
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner className="h-4 w-4" /> Loading project…
      </div>
    );
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

      <GitRemoteCard project={project} />

      {keyError && (
        <Card className="border-red-500/40 p-4 text-sm text-red-700 dark:text-red-300">
          Couldn&apos;t decrypt this project&apos;s key with your current vault passphrase.
        </Card>
      )}

      {projectKey && (
        <div className="flex flex-col gap-2.5">
          {loadingFiles && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="h-4 w-4" /> Loading files…
            </div>
          )}
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
    if (!isDotenvStyleFile(name)) {
      toastError(
        new Error("Only .env files can be stored (.env, .env.local, .env.development, .env.production, …)."),
        "Unsupported file type",
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
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
          <Upload size={15} />
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
            <p className="mt-1 text-xs text-muted">
              Only <code className="font-mono">.env</code> files are accepted — <code className="font-mono">.env</code>,{" "}
              <code className="font-mono">.env.local</code>, <code className="font-mono">.env.production</code>, etc.
            </p>
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".env,.env.local,.env.development,.env.production,.env.test,.env.staging"
            className="hidden"
            onChange={handleFileChange}
          />
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
      <Download size={15} />
      Download all (.zip)
    </Button>
  );
}

const REVEAL_AUTO_HIDE_MS = 10_000;

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
  const [contentLoading, setContentLoading] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "busy" | "done">("idle");
  const [downloadState, setDownloadState] = useState<"idle" | "busy" | "done">("idle");
  const [expanded, setExpanded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [revealSecondsLeft, setRevealSecondsLeft] = useState<number | null>(null);

  // Which version's plaintext currently sits in `content`. Lets us notice when
  // a newer version arrives (e.g. right after an upload) and drop the stale
  // cache so the view pane always reflects the latest version.
  const loadedVersionId = useRef<string | null>(null);
  const currentVersionId = file.currentVersion?.id ?? null;

  async function loadPlaintext(): Promise<string | null> {
    if (content !== null && loadedVersionId.current === currentVersionId) return content;
    if (!currentVersionId) return null;
    try {
      const downloaded = await downloadFileVersion(projectId, file.id, currentVersionId);
      const bytes = await decryptFile(projectKey, downloaded.payload);
      const text = new TextDecoder().decode(bytes);
      loadedVersionId.current = currentVersionId;
      setContent(text);
      return text;
    } catch (err) {
      toastError(err, "Failed to decrypt file");
      return null;
    }
  }

  // A new version landed (upload / restore) while this row is mounted. Discard
  // the cached plaintext; if the view pane is open, show the loading state and
  // pull the latest version back down so the user never sees a stale value.
  useEffect(() => {
    if (!currentVersionId) return;
    if (loadedVersionId.current === null || loadedVersionId.current === currentVersionId) return;
    loadedVersionId.current = null;
    setContent(null);
    if (!revealed) return;
    let cancelled = false;
    setContentLoading(true);
    void loadPlaintext()
      .then((text) => {
        if (!cancelled && text === null) setRevealed(false);
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // loadPlaintext is stable enough for this effect's purpose; only the
    // version id should retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVersionId]);

  async function toggleReveal() {
    if (revealed) {
      setRevealed(false);
      return;
    }
    setRevealed(true);
    if (content === null) {
      setContentLoading(true);
      const text = await loadPlaintext();
      setContentLoading(false);
      if (text === null) setRevealed(false);
    }
  }

  // Auto-hide decrypted contents after a short window to reduce shoulder-surfing risk.
  useEffect(() => {
    if (!revealed || contentLoading || content === null) {
      setRevealSecondsLeft(null);
      return;
    }

    const deadline = Date.now() + REVEAL_AUTO_HIDE_MS;
    setRevealSecondsLeft(Math.ceil(REVEAL_AUTO_HIDE_MS / 1000));

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRevealSecondsLeft(remaining);
    };

    const interval = window.setInterval(tick, 250);
    const timeout = window.setTimeout(() => setRevealed(false), REVEAL_AUTO_HIDE_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [revealed, contentLoading, content, currentVersionId]);

  async function handleCopy() {
    if (copyState === "busy") return;
    setCopyState("busy");
    const text = await loadPlaintext();
    if (text === null) {
      setCopyState("idle");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("done");
      useToastStore.getState().push("success", `Copied ${file.filename} — clear your clipboard when done`);
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
      toastError(new Error("Clipboard unavailable"), "Couldn't copy");
    }
  }

  async function handleDownload() {
    if (downloadState === "busy") return;
    setDownloadState("busy");
    const text = await loadPlaintext();
    if (text === null) {
      setDownloadState("idle");
      return;
    }
    downloadBlob(file.filename, new TextEncoder().encode(text), "text/plain");
    setDownloadState("done");
    useToastStore.getState().push("success", `Downloaded ${file.filename}`);
    setTimeout(() => setDownloadState("idle"), 1800);
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
      <div className="flex items-start gap-3 px-4 py-3.5 sm:items-center">
        <FileLock size={18} className="mt-0.5 shrink-0 text-muted sm:mt-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{file.filename}</span>
          </div>
          {v && (
            <div className="mt-0.5 text-xs leading-relaxed text-muted">
              <span className="block sm:inline">
                <span className="tabular-nums">{formatBytes(v.plaintextSize)}</span>
                <span className="mx-1.5 hidden sm:inline">·</span>
                <span className="font-mono sm:hidden">v{v.versionNumber}</span>
              </span>
              <span className="block sm:inline">
                Updated {formatRelativeTime(v.createdAt)}
              </span>
              <span className="hidden sm:inline">
                <span className="mx-1.5">·</span>
                <span className="font-mono">v{v.versionNumber}</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <RowIcon
            label={contentLoading ? "Decrypting…" : revealed ? "Hide" : "Reveal"}
            onClick={toggleReveal}
            disabled={contentLoading}
          >
            {contentLoading ? (
              <Spinner className="h-4 w-4" />
            ) : revealed ? (
              <EyeOff size={16} />
            ) : (
              <Eye size={16} />
            )}
          </RowIcon>
          <RowIcon
            label={copyState === "done" ? "Copied" : "Copy"}
            onClick={handleCopy}
            disabled={copyState === "busy"}
          >
            {copyState === "busy" ? (
              <Spinner className="h-4 w-4" />
            ) : copyState === "done" ? (
              <Check size={16} className="text-green-600 dark:text-green-400" />
            ) : (
              <Copy size={16} />
            )}
          </RowIcon>
          <RowIcon
            label={downloadState === "done" ? "Downloaded" : "Download"}
            onClick={handleDownload}
            disabled={downloadState === "busy"}
          >
            {downloadState === "busy" ? (
              <Spinner className="h-4 w-4" />
            ) : downloadState === "done" ? (
              <Check size={16} className="text-green-600 dark:text-green-400" />
            ) : (
              <Download size={16} />
            )}
          </RowIcon>
          <RowIcon label="Version history" onClick={() => setExpanded((e) => !e)}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </RowIcon>
          <RowIcon label="Delete" onClick={() => setPendingDelete(true)}>
            <Trash2 size={16} className="text-red-600 dark:text-red-400" />
          </RowIcon>
        </div>
      </div>

      {revealed && (
        <div className="px-4 pb-4 sm:pl-12">
          {contentLoading || content === null ? (
            <div className="flex items-center gap-2 rounded-md border border-line bg-surface-3 px-3.5 py-3 text-xs text-muted">
              <Spinner className="h-3.5 w-3.5" /> Decrypting in your browser…
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span>Decrypted locally — never sent to the server</span>
                {revealSecondsLeft !== null && (
                  <span className="tabular-nums text-amber-700 dark:text-amber-300">
                    Hiding in {revealSecondsLeft}s
                  </span>
                )}
              </div>
              <pre className="dc-scroll m-0 overflow-x-auto rounded-md border border-line bg-surface-3 px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-ink">
                {content}
              </pre>
            </div>
          )}
        </div>
      )}

      {expanded && <VersionHistory projectId={projectId} file={file} projectKey={projectKey} />}

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
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06] hover:text-ink disabled:cursor-default disabled:opacity-100 disabled:hover:bg-transparent"
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
  const { data: history, isLoading } = useFileVersions(projectId, file.id);
  const versions = history?.versions;
  const restore = useRestoreVersion(projectId, file.id);
  const [busyDownload, setBusyDownload] = useState<string | null>(null);
  const [doneDownload, setDoneDownload] = useState<string | null>(null);
  const [busyRestore, setBusyRestore] = useState<string | null>(null);

  async function handleDownload(versionId: string, versionNumber: number) {
    if (busyDownload) return;
    setBusyDownload(versionId);
    try {
      const downloaded = await downloadFileVersion(projectId, file.id, versionId);
      const plaintext = await decryptFile(projectKey, downloaded.payload);
      downloadBlob(`${file.filename}.v${versionNumber}`, plaintext, "text/plain");
      setDoneDownload(versionId);
      useToastStore.getState().push("success", `Downloaded ${file.filename}.v${versionNumber}`);
      setTimeout(() => setDoneDownload((id) => (id === versionId ? null : id)), 1800);
    } catch (err) {
      toastError(err, "Failed to download version");
    } finally {
      setBusyDownload((id) => (id === versionId ? null : id));
    }
  }

  async function handleRestore(versionId: string, versionNumber: number) {
    if (busyRestore) return;
    setBusyRestore(versionId);
    try {
      await restore.mutateAsync(versionId);
      useToastStore.getState().push("success", `Restored v${versionNumber} as the new current version`);
    } catch (err) {
      toastError(err, "Failed to restore version");
    } finally {
      setBusyRestore((id) => (id === versionId ? null : id));
    }
  }

  return (
    <div className="border-t border-line px-4 py-3 sm:pl-12">
      <div className="mb-2 text-[11px] uppercase tracking-[0.06em] text-muted">Version history</div>
      {isLoading && (
        <div className="flex items-center gap-2 py-1.5 text-xs text-muted">
          <Spinner className="h-3.5 w-3.5" /> Loading versions…
        </div>
      )}
      <div className="flex flex-col">
        {versions?.map((ver) => {
          const downloading = busyDownload === ver.id;
          const downloaded = doneDownload === ver.id;
          const restoring = busyRestore === ver.id;
          return (
            <div key={ver.id} className="flex items-center gap-3 py-1.5 text-[13px]">
              <span className="w-9 font-mono text-muted">v{ver.versionNumber}</span>
              <span className="flex-1 text-ink/70">
                {formatRelativeTime(ver.createdAt)} · {formatBytes(ver.plaintextSize)}
              </span>
              {ver.isCurrent ? (
                <Tag variant="neutral">current</Tag>
              ) : (
                <>
                  <button
                    onClick={() => handleDownload(ver.id, ver.versionNumber)}
                    disabled={downloading || restoring}
                    className="focus-ring inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-accent-600 hover:bg-accent-500/10 disabled:opacity-70 dark:text-accent-300"
                  >
                    {downloading ? (
                      <Spinner className="h-3 w-3" />
                    ) : downloaded ? (
                      <Check size={12} className="text-green-600 dark:text-green-400" />
                    ) : null}
                    {downloading ? "Downloading…" : downloaded ? "Downloaded" : "Download"}
                  </button>
                  <button
                    onClick={() => handleRestore(ver.id, ver.versionNumber)}
                    disabled={restoring || downloading}
                    className="focus-ring inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-accent-600 hover:bg-accent-500/10 disabled:opacity-70 dark:text-accent-300"
                  >
                    {restoring && <Spinner className="h-3 w-3" />}
                    {restoring ? "Restoring…" : "Restore"}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {history?.capped && (
        <p className="mt-2 text-[11px] text-muted">
          Free keeps the last {history.limit} versions of each file.{" "}
          <Link href="/settings/billing" className="text-accent-600 hover:underline dark:text-accent-300">
            Upgrade to Pro
          </Link>{" "}
          for full history.
        </p>
      )}
    </div>
  );
}
