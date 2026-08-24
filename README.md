# EnvVault

**Your development environment, available anywhere.**

A zero-knowledge vault for `.env` and other project configuration files —
store them once, restore them on any machine (laptop, WSL, a fresh CI
runner, a remote server) via the web app or the `envvault` CLI. See
[SECURITY.md](./SECURITY.md) for the full threat model.

## Monorepo layout

```
apps/
  api/     NestJS backend — stores only encrypted blobs + metadata
  web/     Next.js App Router web app — all encryption happens here (browser)
  cli/     envvault CLI — all encryption happens here (Node), for WSL/SSH/servers
packages/
  crypto/  Shared zero-knowledge envelope-encryption primitives (WebCrypto)
  types/   Shared zod DTOs + filename validation, used by api/web/cli
```

The web app and CLI never duplicate encryption logic — both call the exact
same functions in `packages/crypto`, so their security properties are
identical by construction.

## Prerequisites

- Node.js >= 20
- pnpm (`corepack enable` will fetch the pinned version automatically)
- PostgreSQL 14+ (a `docker-compose.yml` is provided; a portable local
  install also works fine)

## Setup

```bash
pnpm install

# Database
docker compose up -d postgres
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env: DATABASE_URL, and generate a JWT_SECRET:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

pnpm --filter @envvault/api run prisma:migrate

# Web app
cp apps/web/.env.local.example apps/web/.env.local
```

## Running it

```bash
pnpm dev:api    # NestJS API on :4000
pnpm dev:web    # Next.js web app on :3000
```

CLI, against a running API:

```bash
pnpm --filter @envvault/cli run build
node apps/cli/dist/index.js login
# or, once published: envvault login
```

## Testing

```bash
pnpm -r run typecheck
pnpm --filter @envvault/crypto run test    # zero-knowledge envelope encryption
pnpm --filter @envvault/types run test     # filename/path-traversal validation
pnpm --filter @envvault/api run test       # unit tests
pnpm --filter @envvault/api run test:e2e   # full API integration tests (needs Postgres)
pnpm --filter @envvault/cli run test       # git detection, dotenv parsing, gitignore
```

## CLI reference

```
envvault login                      # device-authorization login (no password typed here)
envvault logout
envvault whoami

envvault projects                   # list your projects
envvault project create <name>
envvault project delete <name>

envvault init                       # detect project from git remote, offer to restore
envvault status                     # compare local files against the latest stored version

envvault files [project]
envvault push [project] [file]      # upload — auto-detects .env/.env.local/etc if [file] omitted
envvault pull [project] [file]      # download — safely backs up existing local files first
envvault delete <project> <file>

envvault history <file> [--project <name>]
envvault restore <file> <version> [--project <name>]

envvault run [project] -- <command>   # inject env vars into a child process — never written to disk
```

`[project]` is optional wherever the current directory's git remote
uniquely identifies an EnvVault project; otherwise it's picked
interactively or must be passed explicitly.

## Architecture notes

- **Storage** is behind a `StorageProvider` interface with a zero-dependency
  local-filesystem implementation (the default) and an S3-compatible
  implementation (works with AWS S3, Cloudflare R2, or MinIO via
  `STORAGE_PROVIDER=s3`).
- **Authorization** is enforced on every project/file/version endpoint by
  checking `ownerId` against the authenticated session — mismatches return
  `404`, not `403`, so a project's existence can't be probed by id.
- **Versions are immutable**: restoring an old version creates a new version
  with a copy of the old (still-encrypted) bytes rather than mutating
  history — non-destructive, like a git revert.
