# Deploying EnvVault

Three independently deployable pieces: the web app, the API, and the CLI.
This doc covers all three. See [SECURITY.md](./SECURITY.md) for the threat
model behind the choices below (e.g. why storage must be S3-compatible in
production, why the request body cap is what it is).

## 1. Web app → Vercel

1. Import the repo in Vercel, create a project with **Root Directory:
   `apps/web`**.
2. `apps/web/vercel.json` is already set up to build the workspace's shared
   packages (`@envvault/types`, `@envvault/crypto`) before `next build` —
   nothing else to configure for the build itself.
3. Set the environment variable:
   - `NEXT_PUBLIC_API_URL` → your deployed API's base URL, e.g.
     `https://envvault-api.vercel.app/api/v1`
4. Deploy. That's it — it's a standard Next.js app from here.

## 2. API → Vercel

The NestJS API runs on Vercel as a serverless function
(`apps/api/api/index.ts` wraps the same Nest app `main.ts` boots for any
other host — same modules, same guards, same everything).

1. Create a **second** Vercel project, **Root Directory: `apps/api`**.
2. `apps/api/vercel.json` builds `@envvault/types` and runs
   `prisma generate` before the function is bundled.
3. Environment variables (see `apps/api/.env.example` for the full list):
   - `DATABASE_URL` — **use your Postgres provider's pooled connection
     string** (e.g. Neon or Supabase's PgBouncer endpoint). Serverless
     functions can spin up many concurrent instances; an unpooled
     connection string will exhaust your database's connection limit fast.
   - `DIRECT_DATABASE_URL` — the *unpooled* connection string, used only
     when you run `prisma migrate deploy` (do this from your machine or CI,
     not from the serverless function itself — see step 5).
   - `JWT_SECRET`, `WEB_ORIGIN`, and the rest as documented in `.env.example`.
   - `STORAGE_PROVIDER=s3` with `STORAGE_S3_*` pointed at S3, Cloudflare R2,
     or another S3-compatible bucket. **`STORAGE_PROVIDER=local` will not
     work on Vercel** — serverless functions have no persistent disk.
4. Known platform constraint: Vercel's Node runtime enforces a hard
   **~4.5MB request body limit that cannot be raised**. `MAX_FILE_SIZE_BYTES`
   in `packages/types` is set to 2.5 MiB specifically so base64-encoded
   ciphertext plus JSON overhead always stays comfortably under that,
   across every deployment target — you shouldn't need to touch it, but if
   you do, keep this constraint in mind.
5. Run migrations against `DIRECT_DATABASE_URL` before (or right after) your
   first deploy — Vercel doesn't run this for you:
   ```bash
   DATABASE_URL="$DIRECT_DATABASE_URL" pnpm --filter @envvault/api exec prisma migrate deploy
   ```
6. Rate limiting (`ThrottlerModule`) uses an in-memory store per function
   instance — on serverless this resets per cold start and isn't shared
   across concurrent instances. Acceptable for now; a Redis-backed
   throttler store would be the fix if you need stronger guarantees.

### Alternative: a normal long-running host

Nothing about the API requires serverless. `apps/api` builds to a plain
`node dist/main.js` process (see the root `Dockerfile`-free `pnpm
--filter @envvault/api run build && node dist/main.js`), which runs fine
on Railway, Render, Fly.io, or a VPS — with `STORAGE_PROVIDER=local`
working out of the box there, since disk actually persists. If you don't
need Vercel specifically, this is the simpler path.

## 3. CLI

The CLI is a separate release lifecycle, triggered by pushing a
`cli-vX.Y.Z` tag (see `.github/workflows/cli-release.yml`). One workflow
run:

1. Bundles the CLI into a single dependency-free `dist/index.js` (esbuild).
2. Builds standalone executables for all four platforms — **cross-compiled
   from one Linux runner** via `pkg` (`@yao-pkg/pkg`), no macOS/Windows
   runners needed for the binaries themselves:
   - `envvault-linux-x64`
   - `envvault-macos-x64`
   - `envvault-macos-arm64`
   - `envvault-win-x64.exe`
3. Publishes `@envvault/cli` to npm (needs an `NPM_TOKEN` repo secret).
4. Creates a GitHub Release with all four binaries + a `SHA256SUMS.txt`
   attached.
5. A separate, best-effort `windows-latest` job attempts a WiX-built MSI
   installer (`packaging/windows/envvault.wxs`) and attaches it too — see
   the caveat below.

### Distribution channels this sets up

| Channel | Command | Requires Node.js? |
|---|---|---|
| npm | `npm install -g @envvault/cli` | Yes |
| Standalone binary | download from the release, run directly | No |
| Homebrew (macOS/Linux) | `brew tap BharathLakkoju/envvault && brew install envvault` | No |
| Windows | download `envvault-win-x64.exe` and run it | No |

To cut a release:

```bash
git tag cli-v0.1.0
git push origin cli-v0.1.0
```

### Homebrew tap setup (one-time)

Homebrew requires the formula to live in a repo literally named
`homebrew-envvault` (its tap naming convention) — it can't be installed
straight from this monorepo. `homebrew/envvault.rb` was verified end-to-end
in development: `brew style` confirmed the DSL is structurally valid, and a
full local-tap `brew install` + `brew test` run (pointed at a real built
binary via a `file://` URL standing in for the eventual GitHub release
asset) succeeded — download, sha256 verification, install, and the `--version`
test block all passed. One-time setup for the real tap:

1. Create a GitHub repo named `BharathLakkoju/homebrew-envvault`.
2. Copy `homebrew/envvault.rb` into it as `Formula/envvault.rb`.
3. After each CLI release, regenerate the version/sha256 values and copy
   the updated file over:
   ```bash
   ./scripts/update-homebrew-formula.sh 0.1.0
   ```

### Windows: MSI vs. the plain .exe

The **`.exe` from the release is the tested, always-working path** — no
installer needed, just download and run it (this was verified in this
sandbox: the binary runs standalone with zero PATH/environment
dependencies). The **MSI job is best-effort and unverified** — it was
written and validated for XML well-formedness, but this repo was built in
a Linux sandbox with no Windows machine or WiX toolchain available to
actually run `wix build` against, so treat the first real tagged release as
the first real test of it. It's wired as `continue-on-error: true`
specifically so a broken MSI build never blocks the npm publish or the
binary release.

A lighter-weight alternative worth considering instead of a WiX MSI: a
[winget](https://github.com/microsoft/winget-pkgs) manifest. winget can
install a portable `.exe` directly (no installer required) — just a small
YAML manifest pointing at the release asset + its sha256, submitted as a
PR to `microsoft/winget-pkgs`. Not set up here, but is a natural next step
and doesn't require solving MSI packaging at all.

## Verifying a deployment end to end

Whichever hosts you pick, this should work once `NEXT_PUBLIC_API_URL` (web)
and `ENVVAULT_API_URL` (CLI, via `export ENVVAULT_API_URL=...`) point at
your deployed API:

1. Register an account on the web app.
2. `envvault login` from a terminal, approve the device code in the browser.
3. `envvault projects` should list the account's projects.
4. Create a project + upload a file from the web app; `envvault pull` it
   from the CLI and confirm the content is byte-identical.

This mirrors exactly what `apps/api/test/app.e2e-spec.ts` and the CLI smoke
tests already verify against a local stack — if those pass, the only new
variables in production are the ones this doc calls out (pooled DB
connection, S3 storage, correct env vars).
