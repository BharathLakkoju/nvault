import { z } from "zod";

/**
 * Server-only environment configuration, validated once on first access.
 *
 * Access is lazy (via the Proxy below) so that `next build` — which traces
 * route modules without a populated environment — does not crash. The first
 * real request that touches `env.*` triggers validation and fails loudly if
 * anything required is missing or malformed.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().min(1, "DIRECT_DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  STORAGE_ENCRYPTION_KEY: z
    .string()
    .min(1, "STORAGE_ENCRYPTION_KEY is required")
    .refine((v) => {
      try {
        return Buffer.from(v, "base64").length === 32;
      } catch {
        return false;
      }
    }, "STORAGE_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)"),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof EnvSchema>;

let cached: ServerEnv | undefined;

function load(): ServerEnv {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment configuration:\n${parsed.error.toString()}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get: (_target, prop: string) => load()[prop as keyof ServerEnv],
});

/** The 32-byte server storage key, decoded once. */
export function storageEncryptionKey(): Buffer {
  return Buffer.from(env.STORAGE_ENCRYPTION_KEY, "base64");
}
