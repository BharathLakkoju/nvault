export interface WrappedKeyDto {
  iv: string;
  ciphertext: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  gitRemoteUrl: string | null;
  fileCount?: number;
  scope: "personal" | "org";
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  keyEpoch: number;
  createdAt: string;
  updatedAt: string;
  wrappedProjectKey: WrappedKeyDto;
}

export type OrgRole = "OWNER" | "ADMIN" | "MEMBER";
export type OrgMembershipStatus = "INVITED" | "ACTIVE";
/** Billing lifecycle of the organization itself. */
export type OrgBillingStatus = "PENDING_PAYMENT" | "ACTIVE" | "SUSPENDED";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
export type TeamTier = "STARTER" | "GROWTH" | "SCALE";

export interface TeamTierInfo {
  tier: TeamTier;
  priceLabel: string;
  maxMembers: number;
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  currentKeyEpoch: number;
  /** Billing lifecycle of the org (PENDING_PAYMENT / ACTIVE / SUSPENDED). */
  orgStatus: OrgBillingStatus;
  createdAt: string;
  updatedAt: string;
  role?: OrgRole;
  /** The caller's membership status (INVITED / ACTIVE). */
  status?: OrgMembershipStatus;
  /** The subscription's status, or "NONE" for grandfathered orgs. */
  billingStatus?: SubscriptionStatus | "NONE";
  /** Team size tier of the org's subscription, when known. */
  tier?: TeamTier | null;
  memberCount?: number;
  projectCount?: number;
}

export interface SubscriptionDto {
  status: SubscriptionStatus | "NONE";
  /** Team size tier; null for personal (Pro) subscriptions. */
  tier: TeamTier | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Whether the current user may open the Polar billing portal. */
  manageable: boolean;
}

export interface OrgBillingDto {
  orgStatus: OrgBillingStatus;
  memberCount: number;
  tiers: TeamTierInfo[];
  subscription: SubscriptionDto;
}

export interface OrgMemberDto {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  publicKey: string | null;
  role: OrgRole;
  status: OrgMembershipStatus;
  keyEpoch: number | null;
  createdAt: string;
  keyGrantedAt: string | null;
}

export interface OrganizationDetailDto {
  organization: OrganizationDto & { projectCount: number };
  self: {
    membershipId: string;
    role: OrgRole;
    status: OrgMembershipStatus;
    wrappedOrgKey: string | null;
    keyEpoch: number | null;
  };
  members: OrgMemberDto[];
}

export interface OrgInviteDto {
  id: string;
  email: string;
  role: OrgRole;
  tokenPrefix: string;
  expiresAt: string;
  createdAt: string;
  invitedByEmail: string | null;
}

export interface OrgActivityEntryDto {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  actorEmail: string | null;
  createdAt: string;
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

export interface SessionDto {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  current: boolean;
}

export interface ApiTokenDto {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface AuditLogDto {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}
