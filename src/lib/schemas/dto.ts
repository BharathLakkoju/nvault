import { z } from "zod";
import { isSafeFilename } from "./filename";

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
// laptop", "ci"); it is never secret. `expiresInDays` defaults server-side.
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
  wrappedProjectKey: z.object({ iv: z.string().min(1), ciphertext: z.string().min(1) }),
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

export const CreateOrganizationRequestSchema = z.object({
  name: OrgNameSchema,
  slug: OrgSlugSchema,
  /** The freshly-generated Org Key, wrapped to the creator's own public key. */
  wrappedOrgKey: WrappedOrgKeySchema,
});
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;

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

export const GrantKeyRequestSchema = z.object({
  /** The Org Key, RSA-wrapped to the target member's public key. */
  wrappedOrgKey: WrappedOrgKeySchema,
  /** Must equal the org's current key epoch (stale grants are rejected). */
  keyEpoch: z.number().int().min(0),
});
export type GrantKeyRequest = z.infer<typeof GrantKeyRequestSchema>;

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
        wrappedProjectKey: z.object({ iv: z.string().min(1), ciphertext: z.string().min(1) }),
      }),
    )
    .max(2_000),
  /** Every ACTIVE member, with the new Org Key wrapped to their public key. */
  memberKeys: z
    .array(z.object({ membershipId: z.string().cuid(), wrappedOrgKey: WrappedOrgKeySchema }))
    .min(1)
    .max(200),
});
export type RotateKeyRequest = z.infer<typeof RotateKeyRequestSchema>;

export const RenameProjectRequestSchema = z.object({
  name: ProjectNameSchema,
});
export type RenameProjectRequest = z.infer<typeof RenameProjectRequestSchema>;

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
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
});

// 2.5 MiB plaintext ceiling for config files. Kept well under Vercel's fixed
// ~4.5MB serverless request-body limit even after base64 inflation
// (~3.3MB) plus JSON overhead — a deliberately portable default so the
// same limit works unmodified on every supported deployment target.
export const MAX_FILE_SIZE_BYTES = 2.5 * 1024 * 1024;

export const UploadFileVersionRequestSchema = z.object({
  filename: FilenameSchema,
  payload: EncryptedPayloadSchema,
  // Client-generated (crypto.randomUUID()), bound as AAD when encrypting
  // this version's content so the ciphertext cannot be replayed onto a
  // different file/version record. Stored as opaque metadata and echoed
  // back unchanged on download so the client can reproduce decryption.
  contentId: z.string().uuid(),
  plaintextSize: z.number().int().min(0).max(MAX_FILE_SIZE_BYTES),
  plaintextSha256: z.string().length(64),
});
export type UploadFileVersionRequest = z.infer<typeof UploadFileVersionRequestSchema>;

export const RestoreVersionRequestSchema = z.object({
  versionId: z.string().min(1),
});
export type RestoreVersionRequest = z.infer<typeof RestoreVersionRequestSchema>;
