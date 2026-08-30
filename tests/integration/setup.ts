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
      // strip an unquoted trailing "# inline comment"
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

process.env.STORAGE_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString("base64");
process.env.JWT_SECRET ||= "integration-test-jwt-secret-integration-test-0";

// These tests TRUNCATE-adjacent: they create and delete users, orgs, and
// projects freely. `TEST_DATABASE_URL`, when set, wins over DATABASE_URL so a
// disposable database can be targeted without editing .env (whose
// DATABASE_URL often points at a shared/hosted DB — Neon, staging, etc.).
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.DIRECT_DATABASE_URL ||= process.env.DATABASE_URL ?? "";

// Guard against pointing the suite at a real database. Allowed only when the
// host is local, the database name marks it as throwaway (…test…/…shadow…/
// …ci…), we're on CI, or the operator has explicitly opted in.
if (process.env.DATABASE_URL && !process.env.ALLOW_UNSAFE_INTEGRATION_DB && !process.env.CI) {
  let host = "";
  let dbName = "";
  try {
    const u = new URL(process.env.DATABASE_URL);
    host = u.hostname;
    dbName = u.pathname.replace(/^\//, "");
  } catch {
    /* leave blank — fails the check below */
  }
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/.test(host);
  const throwawayName = /(test|shadow|_ci\b|-ci\b)/i.test(dbName);
  if (!localHost && !throwawayName) {
    throw new Error(
      `[integration] refusing to run against ${host}/${dbName}: it does not look like a ` +
        `disposable test database. Set TEST_DATABASE_URL to a throwaway DB, name the DB ` +
        `"*test*", or set ALLOW_UNSAFE_INTEGRATION_DB=1 to override.`,
    );
  }
}

// Billing: make billingConfigured() true so the paywall path is exercised.
// The Polar HTTP client is mocked in the spec; only the webhook signer
// (which uses POLAR_WEBHOOK_SECRET) runs for real.
process.env.POLAR_ACCESS_TOKEN ||= "polar_test_access_token";
process.env.POLAR_WEBHOOK_SECRET ||= "integration-test-webhook-secret";
process.env.POLAR_PRO_PRODUCT_ID ||= "prod_pro_it";
process.env.POLAR_TEAM_STARTER_PRODUCT_ID ||= "prod_team_starter_it";
process.env.POLAR_TEAM_GROWTH_PRODUCT_ID ||= "prod_team_growth_it";
process.env.POLAR_TEAM_SCALE_PRODUCT_ID ||= "prod_team_scale_it";
process.env.CRON_SECRET ||= "integration-test-cron-secret-0";

if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn("\n[integration] DATABASE_URL not set — integration tests will be skipped.\n");
}

// Generous: each test does several argon2id hashes (~2s each at m=46MiB) plus
// many sequential round trips to a remote Postgres.
jest.setTimeout(120_000);
