export interface WrappedKeyDto {
  iv: string;
  ciphertext: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  gitRemoteUrl: string | null;
  fileCount?: number;
  scope?: "personal" | "org";
  organizationId?: string | null;
  organizationName?: string | null;
  keyEpoch?: number;
  createdAt: string;
  updatedAt: string;
  wrappedProjectKey: WrappedKeyDto;
}

export type OrgRole = "OWNER" | "ADMIN" | "MEMBER";

export interface OrganizationSummaryDto {
  id: string;
  name: string;
  slug: string;
  role?: OrgRole;
  status?: "INVITED" | "ACTIVE";
  /** Billing lifecycle of the org. */
  orgStatus?: "PENDING_PAYMENT" | "ACTIVE" | "SUSPENDED";
  billingStatus?: "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "NONE";
  memberCount?: number;
  projectCount?: number;
}

export interface OrganizationDetailDto {
  organization: { id: string; name: string; slug: string; currentKeyEpoch: number };
  self: {
    membershipId: string;
    role: OrgRole;
    status: "INVITED" | "ACTIVE";
    wrappedOrgKey: string | null;
    keyEpoch: number | null;
  };
}

export interface FileVersionSummaryDto {
  id: string;
  versionNumber: number;
  plaintextSize: number;
  plaintextFingerprint: string;
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
  plaintextFingerprint: string;
}
