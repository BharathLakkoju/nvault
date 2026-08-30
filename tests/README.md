# Tests

| Command | What runs | Needs |
|---|---|---|
| `pnpm test` | Unit — crypto primitives, schema/DTO, server helpers (`src/**/*.spec.ts`) | nothing |
| `pnpm test:integration` | API ⇄ Postgres — `tests/integration/**` | `DATABASE_URL` |
| `pnpm test:cli:integration` | CLI ⇄ API ⇄ Postgres — `tests/cli-integration/**` | `DATABASE_URL` |
| `cd cli && pnpm test` | CLI unit — git/dotenv/config-dir parsing etc. | nothing |

## Integration suites

All integration suites drive the **real Next.js Route Handlers** against a
**real Postgres**. They only ever create and delete their own throwaway users
(`it_*@example.com`, `cli_it_*@example.com`) — they never `TRUNCATE`.

`tests/integration/setup.ts` refuses to run against a database whose name
doesn't look disposable (no `test`/`shadow`/`ci` in it) and whose host isn't
local. To target the shared Neon dev DB anyway:

```bash
ALLOW_UNSAFE_INTEGRATION_DB=1 pnpm test:integration
ALLOW_UNSAFE_INTEGRATION_DB=1 pnpm test:cli:integration
```

Prefer pointing `TEST_DATABASE_URL` at a disposable database instead.

| File | Focus |
|---|---|
| `integration/api.spec.ts` | Encryption round-trip, envelope-at-rest, versioning, webhook auth + idempotency, org key rotation, RBAC, billing lifecycle |
| `integration/scenarios.spec.ts` | One test per persona in [`docs/test-scenarios.md`](../docs/test-scenarios.md) — the "Expected:" line for each of the 19 Free/Pro/Team/isolation scenarios |
| `integration/leakage.spec.ts` | **Fails the build on any leak.** No plaintext secret / passphrase / token / key byte in any API response, bulk export, audit log, org activity feed, server log line, at-rest storage blob, or error body; cross-tenant IDs return 404 (not 403) with no data |
| `integration/helpers.ts` | Shared harness: `call`, route table, account/org factories, `assertNoLeak`, `captureConsole` |
| `cli-integration/cli.spec.ts` | Real `cli/src` command functions: login + credential file perms, byte-exact push/pull, backup-before-overwrite, Free/Pro caps, git-remote detection, revoked-token 401 |
| `cli-integration/run.spec.ts` | `nvault run --` injects decrypted vars into a child process, writes nothing to disk, mirrors exit codes |
| `cli-integration/harness.ts` | `fetch` shim routing the CLI's HTTP calls into the Route Handlers in-process |

See [`docs/hipaa-security-rule-assessment.md`](../docs/hipaa-security-rule-assessment.md)
§9 for how these map onto the HIPAA Security Rule technical safeguards.
