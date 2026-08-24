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

export const DeviceAuthorizeStartResponseSchema = z.object({
  deviceCode: z.string(),
  userCode: z.string(),
  verificationUri: z.string(),
  expiresInSeconds: z.number(),
  pollIntervalSeconds: z.number(),
});
export type DeviceAuthorizeStartResponse = z.infer<typeof DeviceAuthorizeStartResponseSchema>;

export const DeviceApproveRequestSchema = z.object({
  userCode: z.string().min(1),
});
export type DeviceApproveRequest = z.infer<typeof DeviceApproveRequestSchema>;

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
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

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
