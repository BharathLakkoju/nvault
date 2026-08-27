/**
 * Integration tests hit a real Postgres. They are skipped (see `describeIf`
 * in the spec) unless DATABASE_URL is set — locally via a gitignored .env,
 * in CI via a service container.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env loader (jest, unlike `next`, does not read .env itself).
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

process.env.STORAGE_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString("base64");
process.env.JWT_SECRET ||= "integration-test-jwt-secret-integration-test-0";
process.env.DIRECT_DATABASE_URL ||= process.env.DATABASE_URL ?? "";

if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn("\n[integration] DATABASE_URL not set — integration tests will be skipped.\n");
}

jest.setTimeout(30000);
