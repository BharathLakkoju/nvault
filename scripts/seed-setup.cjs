/**
 * Runs before scripts/seed-test-scenarios.ts is required, so DATABASE_URL is
 * present when src/server/db.ts constructs the Prisma adapter at import time.
 *
 * Parses .env by hand — jest's node environment does not expose
 * `process.loadEnvFile`, and jest (unlike `next`) never loads .env itself.
 */
const { randomBytes } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

// The seed script never signs JWTs and only uses the storage key to seal file
// blobs; real values come from .env. These per-run random fallbacks just keep
// the script importable against a bare environment.
process.env.STORAGE_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
process.env.JWT_SECRET ||= randomBytes(36).toString("base64");
process.env.NODE_ENV ||= "development";

if (!process.env.DATABASE_URL) {
  throw new Error("[seed] DATABASE_URL is not set (no .env found and none in the environment)");
}
process.env.DIRECT_DATABASE_URL ||= process.env.DATABASE_URL;
