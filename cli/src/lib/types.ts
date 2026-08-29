export interface WrappedKeyDto {
  iv: string;
  ciphertext: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  gitRemoteUrl: string | null;
  fileCount?: number;
  createdAt: string;
  updatedAt: string;
  wrappedProjectKey: WrappedKeyDto;
}

export interface FileVersionSummaryDto {
  id: string;
  versionNumber: number;
  plaintextSize: number;
  plaintextSha256: string;
  createdAt: string;
  isCurrent?: boolean;
}

export interface FileDto {
  id: string;
  filename: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: FileVersionSummaryDto | null;
}

export interface DownloadedFileDto {
  filename: string;
  payload: { iv: string; ciphertext: string; contentId: string };
  plaintextSize: number;
  plaintextSha256: string;
}
