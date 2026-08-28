"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFileVersions, useRestoreVersion, downloadFileVersion } from "@/hooks/use-files";
import { decryptFile } from "@/lib/vault-client";
import { downloadBlob } from "@/lib/download";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { toastError, useToastStore } from "@/lib/toast-store";
import type { FileDto } from "@/lib/types";

export function VersionHistoryDialog({
  open,
  onOpenChange,
  projectId,
  file,
  projectKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  file: FileDto;
  projectKey: Uint8Array;
}) {
  const { data: versions, isLoading } = useFileVersions(projectId, open ? file.id : null);
  const restoreVersion = useRestoreVersion(projectId, file.id);

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
      await restoreVersion.mutateAsync(versionId);
      useToastStore.getState().push("success", `Restored v${versionNumber} as the new current version`);
    } catch (err) {
      toastError(err, "Failed to restore version");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Version history — ${file.filename}`} className="max-w-lg">
        {isLoading && <p className="text-sm text-slate-500">Loading versions…</p>}
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {versions?.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <span className="font-medium text-slate-900 dark:text-slate-100">v{v.versionNumber}</span>
                {v.isCurrent && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
                    current
                  </span>
                )}
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatRelativeTime(v.createdAt)} · {formatBytes(v.plaintextSize)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => handleDownload(v.id, v.versionNumber)}>
                  Download
                </Button>
                {!v.isCurrent && (
                  <Button
                    variant="secondary"
                    loading={restoreVersion.isPending}
                    onClick={() => handleRestore(v.id, v.versionNumber)}
                  >
                    Restore
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
