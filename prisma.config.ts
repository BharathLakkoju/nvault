import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env. Only the CLI (migrate/db push/studio)
// evaluates this file; the Next.js app never does — it gets its env from
// Next's own loader. Load .env here for local `prisma migrate` runs; in CI/
// hosted environments the variables are already present so a missing file is
// not an error.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // no .env file — assume the environment is already populated
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Unpooled connection — `prisma migrate` must not run through a
    // transaction-mode pooler (PgBouncer). On a plain local Postgres this is
    // the same value as DATABASE_URL.
    url: env("DIRECT_DATABASE_URL"),
  },
});
