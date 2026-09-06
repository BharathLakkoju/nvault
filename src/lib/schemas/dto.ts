import { z } from "zod";
import { isDotenvStyleFile, isSafeFilename } from "./filename";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

// Login password policy is intentionally independent from the vault
// passphrase policy below: this is the *account* credential, checked by the
// server; it is never used as encryption key material.
export const AccountPasswordSchema = z.string().min(12).max(256);

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: AccountPasswordSchema,
  name: z.string().trim().min(1).max(120).optional(),
  // Vault key material generated client-side during provisionVault().
  kdfSalt: z.string().min(1),
  kdfIterations: z.number().int().min(100_000),
  wrappedMasterKey: z.object({ iv: z.string().min(1), ciphertext: z.string().min(1) }),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(256),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// Per-user asymmetric keypair (RSA-OAEP-3072, see src/lib/crypto/asymmetric.ts).
// `publicKey` is cleartext SPKI (base64); `wrappedPrivateKey` is the PKCS#8
// key encrypted under the user's master key — opaque to the server.
// Provisioned once, on the client, after the vault is unlocked.
export const WrappedKeySchema = z.object({
  iv: z.string().min(1).max(256),
  ciphertext: z.string().min(1).max(20_000),
});

export const ProvisionKeyPairRequestSchema = z.object({
  publicKey: z.string().min(1).max(4_000),
  wrappedPrivateKey: WrappedKeySchema,
});
export type ProvisionKeyPairRequest = z.infer<typeof ProvisionKeyPairRequestSchema>;

// CLI Personal Access Tokens. `name` is a user-facing label only ("work
// laptop", "ci"); it is never secret. `expiresInDays` defaults to 90 days
// server-side and may be extended up to 365 days explicitly.
export const CreateApiTokenRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateApiTokenRequest = z.infer<typeof CreateApiTokenRequestSchema>;

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const ProjectNameSchema = z.string().trim().min(1).max(100);

export const CreateProjectRequestSchema = z.object({
  // Client-generated (crypto.randomUUID()): the project key is wrapped with
  // this id bound as AAD *before* the project exists server-side, so the id
  // must originate on the client rather than being assigned on creation.
  id: z.string().uuid(),
  name: ProjectNameSchema,
  gitRemoteUrl: z.string().trim().max(500).optional(),
  wrappedProjectKey: WrappedKeySchema,
  // When set, this is an organization project: the caller must be an
  // ADMIN/OWNER of the org, and `wrappedProjectKey` is wrapped under the
  // Organization Key (not a user master key). Omit for a personal project.
  organizationId: z.string().cuid().optional(),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const OrgNameSchema = z.string().trim().min(1).max(100);
export const OrgSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/,
    "URL must be 3–40 characters: lowercase letters, numbers, and hyphens (not at the ends).",
  );

// RSA-OAEP ciphertext (base64) of the 32-byte Organization Key, wrapped to a
// member's public key. ~512 bytes for a 3072-bit key; cap generously.
export const WrappedOrgKeySchema = z.string().min(1).max(4_000);

// SPKI public key (base64), same shape as ProvisionKeyPairRequestSchema.
export const PublicKeySchema = z.string().min(1).max(4_000);

// The Org Key wrapped under a KEK derived from the Enrollment Secret, plus
// its KDF parameters. All opaque — see src/lib/crypto/org-enrollment.ts.
export const EnrollmentWrapSchema = z.object({
  kdfSalt: z.string().min(1).max(256),
  kdfIterations: z.number().int().min(100_000).max(10_000_000),
  wrappedOrgKey: WrappedKeySchema,
});

// AES-GCM ciphertext of the member roster (keyed under the Org Key). Grows
// with membership; a 200-member org is well under this cap.
export const RosterCiphertextSchema = z.object({
  iv: z.string().min(1).max(256),
  ciphertext: z.string().min(1).max(200_000),
});

export const TeamTierSchema = z.enum(["STARTER", "GROWTH", "SCALE"]);

export const CreateOrganizationRequestSchema = z.object({
  name: OrgNameSchema,
  slug: OrgSlugSchema,
  /** The freshly-generated Org Key, wrapped to the creator's own public key. */
  wrappedOrgKey: WrappedOrgKeySchema,
  /** The same Org Key wrapped under the Enrollment Secret (for future members). */
  enrollment: EnrollmentWrapSchema,
  /** Initial roster: exactly the creator's own membership entry, under the Org Key. */
  roster: RosterCiphertextSchema,
  /** The creator's own public key, pinned for later rotation checks. */
  pinnedPublicKey: PublicKeySchema,
  /** Team size tier to bill for. Defaults to the smallest. */
  tier: TeamTierSchema.default("STARTER"),
});
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;

export const EnrollRequestSchema = z.object({
  /** The Org Key (recovered via the Enrollment Secret) re-wrapped to my own public key. */
  wrappedOrgKey: WrappedOrgKeySchema,
  /** Must equal the org's current key epoch. */
  keyEpoch: z.number().int().min(0),
  /** My own public key — pinned so rotation can detect a substituted key. */
  pinnedPublicKey: PublicKeySchema,
  /** The roster with my entry added, re-encrypted under the Org Key. */
  roster: RosterCiphertextSchema,
  /** The roster version I based my edit on (optimistic concurrency). */
  expectedRosterVersion: z.number().int().min(0),
});
export type EnrollRequest = z.infer<typeof EnrollRequestSchema>;

export const ChangeTierRequestSchema = z.object({ tier: TeamTierSchema });
export type ChangeTierRequest = z.infer<typeof ChangeTierRequestSchema>;

export const UpdateOrganizationRequestSchema = z
  .object({
    name: OrgNameSchema.optional(),
    slug: OrgSlugSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.slug !== undefined, {
    message: "Provide a new name or URL.",
  });
export type UpdateOrganizationRequest = z.infer<typeof UpdateOrganizationRequestSchema>;

export const OrgRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export const CreateInviteRequestSchema = z.object({
  email: EmailSchema,
  role: OrgRoleSchema,
});
export type CreateInviteRequest = z.infer<typeof CreateInviteRequestSchema>;

export const AcceptInviteRequestSchema = z.object({
  token: z.string().min(1).max(200),
});
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;

export const UpdateMembershipRequestSchema = z.object({
  role: OrgRoleSchema,
});
export type UpdateMembershipRequest = z.infer<typeof UpdateMembershipRequestSchema>;

export const TransferOwnershipRequestSchema = z.object({
  toMembershipId: z.string().cuid(),
});
export type TransferOwnershipRequest = z.infer<typeof TransferOwnershipRequestSchema>;

export const RotateKeyRequestSchema = z.object({
  /** Must equal the org's current epoch + 1. */
  newEpoch: z.number().int().min(1),
  /** Every org project, re-wrapped under the new Org Key. */
  projectKeys: z
    .array(
      z.object({
        projectId: z.string().uuid(),
        wrappedProjectKey: WrappedKeySchema,
      }),
    )
    .max(2_000),
  /** Every ACTIVE member, with the new Org Key wrapped to their public key. */
  memberKeys: z
    .array(z.object({ membershipId: z.string().cuid(), wrappedOrgKey: WrappedOrgKeySchema }))
    .min(1)
    .max(200),
  /** The new Org Key wrapped under a freshly-generated Enrollment Secret. */
  enrollment: EnrollmentWrapSchema,
  /** The roster re-encrypted under the new Org Key (same entries). */
  roster: RosterCiphertextSchema,
  /** The roster version the rotation was based on (optimistic concurrency). */
  expectedRosterVersion: z.number().int().min(0),
});
export type RotateKeyRequest = z.infer<typeof RotateKeyRequestSchema>;

export const RenameProjectRequestSchema = z.object({
  name: ProjectNameSchema,
});
export type RenameProjectRequest = z.infer<typeof RenameProjectRequestSchema>;

export const UpdateProjectRequestSchema = z
  .object({
    name: ProjectNameSchema.optional(),
    gitRemoteUrl: z.union([z.string().trim().max(500), z.null()]).optional(),
  })
  .refine((data) => data.name !== undefined || data.gitRemoteUrl !== undefined, {
    message: "At least one field must be provided",
  });
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export const FilenameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine(isSafeFilename, {
    message:
      "Filename may only contain letters, numbers, dots, hyphens, and underscores, and must not contain path separators or '..'.",
  });

export const EncryptedPayloadSchema = z.object({
  iv: z.string().min(1).max(256),
  ciphertext: z.string().min(1).max(4_000_000),
});

// 2.5 MiB plaintext ceiling for config files. Kept well under Vercel's fixed
// ~4.5MB serverless request-body limit even after base64 inflation
// (~3.3MB) plus JSON overhead — a deliberately portable default so the
// same limit works unmodified on every supported deployment target.
export const MAX_FILE_SIZE_BYTES = 2.5 * 1024 * 1024;

// Uploads are restricted to dotenv-style names (`.env`, `.env.local`,
// `.env.production`, …). This is enforced server-side so the client check is
// not the only gate.
export const DotenvFilenameSchema = FilenameSchema.refine(isDotenvStyleFile, {
  message: "Only .env files can be stored (.env, .env.local, .env.development, .env.production, …).",
});

export const UploadFileVersionRequestSchema = z.object({
  filename: DotenvFilenameSchema,
  payload: EncryptedPayloadSchema,
  // Client-generated (crypto.randomUUID()), bound as AAD when encrypting
  // this version's content so the ciphertext cannot be replayed onto a
  // different file/version record. Stored as opaque metadata and echoed
  // back unchanged on download so the client can reproduce decryption.
  contentId: z.string().uuid(),
  plaintextSize: z.number().int().min(0).max(MAX_FILE_SIZE_BYTES),
  plaintextFingerprint: z.string().length(64),
});
export type UploadFileVersionRequest = z.infer<typeof UploadFileVersionRequestSchema>;

export const RestoreVersionRequestSchema = z.object({
  versionId: z.string().min(1),
});
export type RestoreVersionRequest = z.infer<typeof RestoreVersionRequestSchema>;
