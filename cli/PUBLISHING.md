# Publishing the nvault CLI (`@lbharath/nvault`)

The npm package lives in `cli/`. The web app deploy (Vercel) and the CLI publish are **separate** — fixing API bugs requires redeploying the app; shipping CLI changes requires an npm publish.

## When do you need a new CLI release?

Publish a new CLI version when you change anything under `cli/` (commands, API client, crypto wiring, prompts, etc.).

You do **not** need a CLI release for:

- Database migrations (`pnpm prisma migrate deploy`)
- Web/API-only fixes under `src/app/api/` or `src/server/`
- UI-only changes in the Next.js app

If users report `Internal server error` on `nvault files` / `nvault pull` but the web app works, redeploy **Vercel** first — that is almost always a stale server deployment, not an outdated CLI.

## Prerequisites

- Node.js ≥ 20
- pnpm (monorepo root: `pnpm install`)
- npm account with publish access to `@lbharath/nvault`
- Logged in: `npm login`

## 1. Verify locally

From the repo root:

```bash
pnpm install
pnpm --filter @lbharath/nvault typecheck
pnpm --filter @lbharath/nvault test
pnpm --filter @lbharath/nvault build
```

Smoke-test against your server (local or production):

```bash
cd cli
node dist/index.js whoami
node dist/index.js files <project-name>
```

Or link globally for a quick check:

```bash
cd cli
pnpm link --global
nvault whoami
```

## 2. Bump the version

### Automated (recommended)

1. In GitHub: **Actions → CLI Version Bump → Run workflow**.
   - Choose **patch** / **minor** / **major**, or set **version** to an explicit `X.Y.Z` (must be greater than the current version).
2. The workflow opens a PR from `release/cli-vX.Y.Z` to `master` titled `chore(cli): release vX.Y.Z` (bumps `cli/package.json` and `pnpm-lock.yaml`).
   - Re-running for the same target version updates the remote release branch (explicit `--force-with-lease` via `git ls-remote` when the branch already exists), refreshes an **open** release PR, or opens a new PR if the previous one was closed.
   - If **`NVAULT_RELEASE_TOKEN`** is **not** configured, the bump workflow runs the same lint/test/build steps as CI on the release branch **before** opening the PR (and fails without creating a PR if anything breaks).
   - If **`NVAULT_RELEASE_TOKEN`** **is** set, the workflow uses it to push the branch and open the PR so the normal **CI** workflow runs on the PR (duplicate checks are skipped in the bump workflow).
3. Review and merge the PR.
4. **CLI Tag Release** runs on merge, creates git tag `cli-vX.Y.Z`, then **Publish CLI** runs (see below).

### Optional secret: `NVAULT_RELEASE_TOKEN`

Fine-grained PAT or GitHub App installation token with **`contents: write`** (and **`pull-requests: write`** if the token must open PRs) on this repository.

| Configured | Release PR | Tag push | npm publish |
| ---------- | ---------- | -------- | ----------- |
| **Yes** | Normal **CI** checks on the PR | Tag pushed with the PAT | **CLI Tag Release** dispatches **Publish CLI** (`workflow_dispatch`) |
| **No** | In-workflow CI in **CLI Version Bump** before the PR is opened; PR may show no CI checks | **CLI Tag Release** fails when pushing the tag (no npm publish) | — |

**CLI Tag Release** requires **`NVAULT_RELEASE_TOKEN`** to push the release tag. Tags pushed with the default `GITHUB_TOKEN` do not trigger other workflows on tag push, so **Publish CLI** is started explicitly with `gh workflow run` (still the same workflow file npm Trusted Publishing must list).

Store the value only in **Settings → Secrets and variables → Actions** as `NVAULT_RELEASE_TOKEN`. Do not commit it.

Dry-run the bump logic locally (does not write files):

```bash
node --experimental-strip-types scripts/cli-bump-version.ts resolve --current "$(node -p "require('./cli/package.json').version")" --bump patch
node --experimental-strip-types scripts/cli-bump-version.ts apply --dry-run --bump minor
```

### Manual

Edit `cli/package.json` → `"version"` (semver).

Follow [semver](https://semver.org/):

- **patch** — bug fixes, error messages, no breaking CLI UX
- **minor** — new commands or flags, backward compatible
- **major** — breaking changes (removed flags, changed auth flow, etc.)

## 3. Build the bundle

```bash
cd cli
pnpm run build
```

This runs `esbuild` and writes a single bundled `dist/index.js` (shared `@core/crypto` is inlined).

## 4. Publish to npm

### npm Trusted Publishing (required for CI)

In [npmjs.com](https://www.npmjs.com/) → **@lbharath/nvault** → **Settings** → **Trusted Publisher** → **GitHub Actions**, add:

| Field | Value |
| ----- | ----- |
| **Organization or user** | `BharathLakkoju` |
| **Repository** | `nvault` |
| **Workflow filename** | `cli-release.yml` |
| **Environment name** | *(leave empty)* |

The package owner must save this once. **Publish CLI** uses OIDC (`id-token: write`) and `npm publish --provenance`; no `NPM_TOKEN` secret is stored in GitHub.

If the workflow fails with an OIDC / token-exchange error, the trusted publisher is missing or does not match the table above.

### CI (after merge)

1. **CLI Tag Release** creates tag `cli-vX.Y.Z` on merge (needs **`NVAULT_RELEASE_TOKEN`** to push the tag).
2. It dispatches **Publish CLI** (`.github/workflows/cli-release.yml`) for that tag when the version is not already on npm.
3. **Publish CLI** also runs on `push` of `cli-v*` tags when your git host delivers that event; the dispatch step covers PAT-pushed tags that do not trigger tag workflows.

Re-running **Publish CLI** for the same tag is safe: it skips with success if `@lbharath/nvault@X.Y.Z` is already published.

### Publish an existing tag from Actions (manual)

Use this when a tag exists (for example `cli-v0.2.0`) but npm never received that version:

1. GitHub → **Actions** → **Publish CLI** → **Run workflow**.
2. Either choose **Use workflow from** → pick tag `cli-vX.Y.Z`, **or** run from `master` and set **tag** to `cli-vX.Y.Z`.
3. Confirm the run checks out that tag and that `cli/package.json` matches.

### Manual (from your machine)

```bash
cd cli
npm publish --access public
```

`prepublishOnly` in `cli/package.json` runs typecheck, tests, and build automatically before publish.

### Dry run (optional)

```bash
cd cli
npm pack
# inspect nvault-0.x.x.tgz, then:
npm publish --access public --dry-run
```

## 5. Verify on npm

```bash
npm view @lbharath/nvault version
npx @lbharath/nvault@latest --version
npx @lbharath/nvault@latest whoami
```

## 6. Tell users to upgrade

```bash
npm install -g @lbharath/nvault@latest
# or
npm update -g @lbharath/nvault
```

Credentials in `~/.config/nvault/credentials.json` (or `%APPDATA%\nvault\credentials.json` on Windows) are preserved across upgrades.

---

## Deploying the web app (related, not the same as CLI publish)

After schema or API changes:

1. **Run migrations** on production (direct DB URL):

   ```bash
   DATABASE_URL="$DIRECT_DATABASE_URL" pnpm prisma migrate deploy
   ```

2. **Deploy Vercel** (push to the connected branch or trigger redeploy in the Vercel dashboard).

3. Confirm: register → create project → upload `.env` → download in web UI → `nvault files <project>`.

See [DEPLOYMENT.md](../DEPLOYMENT.md) for environment variables and platform notes.

---

## Checklist (copy before each release)

- [ ] `cli/package.json` version bumped (via **CLI Version Bump** workflow or manual edit)
- [ ] Release PR merged; tag `cli-vX.Y.Z` exists on `master`
- [ ] `pnpm --filter @lbharath/nvault test` passes
- [ ] `pnpm --filter @lbharath/nvault build` passes
- [ ] Smoke-tested against target API URL
- [ ] `npm publish --access public` from `cli/`
- [ ] Tag release in git (optional): `git tag cli-v0.x.x && git push origin cli-v0.x.x`
