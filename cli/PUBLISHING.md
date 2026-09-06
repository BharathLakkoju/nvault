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

- [ ] `cli/package.json` version bumped
- [ ] `pnpm --filter @lbharath/nvault test` passes
- [ ] `pnpm --filter @lbharath/nvault build` passes
- [ ] Smoke-tested against target API URL
- [ ] `npm publish --access public` from `cli/`
- [ ] Tag release in git (optional): `git tag cli-v0.x.x && git push origin cli-v0.x.x`
