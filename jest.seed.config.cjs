/**
 * Standalone Jest config for the test-scenario seed harness
 * (`scripts/seed-test-scenarios.ts`).
 *
 * It is deliberately NOT part of jest.config.cjs's `projects` array, so a
 * normal `pnpm test` / `pnpm test:integration` run never picks it up — the
 * script TRUNCATEs the target database. Run it explicitly:
 *
 *   pnpm seed:scenarios
 *
 * The seed script talks to a real Postgres (DATABASE_URL, loaded from .env by
 * the script itself). It reuses ts-jest only as a convenient TypeScript
 * runner — Prisma 7 emits a `.ts` client that has to be transpiled.
 */
const tsJest = [
  "ts-jest",
  {
    tsconfig: {
      module: "nodenext",
      moduleResolution: "nodenext",
      esModuleInterop: true,
      types: ["node", "jest"],
    },
  },
];

module.exports = {
  displayName: "seed",
  testEnvironment: "node",
  transform: { "^.+\\.tsx?$": tsJest },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  modulePathIgnorePatterns: ["<rootDir>/cli/"],
  setupFiles: ["<rootDir>/scripts/seed-setup.cjs"],
  testMatch: ["<rootDir>/scripts/seed-test-scenarios.ts"],
  // One long-running script; give it room for argon2 + PBKDF2 + remote round trips.
  testTimeout: 600_000,
};
