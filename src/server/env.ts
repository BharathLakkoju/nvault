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

  // --- Billing (Polar) ---------------------------------------------------
  // Optional in dev/test so the app and the integration suite run without a
  // Polar account; the superRefine below makes them mandatory in production.
  // No card data ever touches nvault — checkout and card management happen on
  // Polar-hosted pages (see src/server/billing, SECURITY.md).
  POLAR_ACCESS_TOKEN: z.string().min(1).optional(),
  POLAR_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Polar products: one per-user Pro plan + three flat Team size tiers.
  POLAR_PRO_PRODUCT_ID: z.string().min(1).optional(),
  POLAR_TEAM_STARTER_PRODUCT_ID: z.string().min(1).optional(),
  POLAR_TEAM_GROWTH_PRODUCT_ID: z.string().min(1).optional(),
  POLAR_TEAM_SCALE_PRODUCT_ID: z.string().min(1).optional(),
  POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
  // Human-readable prices shown in the upgrade UI. The real amounts are set
  // on the Polar products; these are display only.
  PRO_PLAN_PRICE_LABEL: z.string().min(1).default("$10 / month"),
  TEAM_STARTER_PRICE_LABEL: z.string().min(1).default("$29 / month"),
  TEAM_GROWTH_PRICE_LABEL: z.string().min(1).default("$79 / month"),
  TEAM_SCALE_PRICE_LABEL: z.string().min(1).default("$199 / month"),
  // Shared secret for the pending-org purge cron endpoint.
  CRON_SECRET: z.string().min(16).optional(),
  // Origin used to build Polar success/return URLs. Falls back to the
  // marketing site origin.
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
}).superRefine((val, ctx) => {
  if (val.NODE_ENV !== "production") return;
  const required = [
    "POLAR_ACCESS_TOKEN",
    "POLAR_WEBHOOK_SECRET",
    "POLAR_PRO_PRODUCT_ID",
    "POLAR_TEAM_STARTER_PRODUCT_ID",
    "POLAR_TEAM_GROWTH_PRODUCT_ID",
    "POLAR_TEAM_SCALE_PRODUCT_ID",
    "CRON_SECRET",
  ] as const;
  for (const key of required) {
    if (!val[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production (billing is enabled)`,
      });
    }
  }
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

/**
 * Absolute origin of the running app, used to build Polar success / return
 * URLs. Prefers NEXT_PUBLIC_APP_URL, then the marketing site origin, then a
 * localhost default for dev. Never has a trailing slash.
 */
export function appOrigin(): string {
  const raw = env.NEXT_PUBLIC_APP_URL ?? env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Whether Polar billing is fully configured (token, secret, all products). */
export function billingConfigured(): boolean {
  return Boolean(
    env.POLAR_ACCESS_TOKEN &&
      env.POLAR_WEBHOOK_SECRET &&
      env.POLAR_PRO_PRODUCT_ID &&
      env.POLAR_TEAM_STARTER_PRODUCT_ID &&
      env.POLAR_TEAM_GROWTH_PRODUCT_ID &&
      env.POLAR_TEAM_SCALE_PRODUCT_ID,
  );
}
