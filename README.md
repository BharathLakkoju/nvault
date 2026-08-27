# EnvVault

**Your development environment, available anywhere.**

A zero-knowledge vault for `.env` and other project configuration files —
store them once through the web app, restore them on any machine. All
encryption happens in your browser; the server only ever sees ciphertext.
See [SECURITY.md](./SECURITY.md) for the full threat model.

## What this is

A single [Next.js](https://nextjs.org) App Router application, deployable to
Vercel with nothing else but a Postgres database:

```
src/
  app/            web pages + the API as Route Handlers under app/api/v1/*
  components/     UI
  hooks/          react-query hooks
  lib/
    crypto/       zero-knowledge envelope-encryption primitives (WebCrypto)
    schemas/      shared zod DTOs + filename/path-traversal validation
    *             browser API client, stores, helpers
  server/         server-only: db, auth, services, storage, rate limiting
prisma/           schema + migrations
```

The API and the browser share the same `lib/schemas` validation and
`lib/crypto` primitives, so request validation and encryption behaviour are
identical by construction.

> The terminal CLI (`envvault`) and `envvault run` process injection are not
> part of this deployment. The API surface is designed so a future CLI could
> be added without server changes.

## Prerequisites

- Node.js >= 20
- pnpm 11 (`corepack enable`)
- PostgreSQL 15+ for local dev (`docker compose up -d postgres`), or a hosted
  Postgres (Neon / Supabase)

## Setup

```bash
pnpm install

docker compose up -d postgres          # local Postgres on :5432
cp .env.example .env                    # then fill in the 4 values it lists
pnpm prisma migrate deploy              # create the schema
```

Generate the two secrets `.env` needs:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"  # JWT_SECRET
openssl rand -base64 32                                                       # STORAGE_ENCRYPTION_KEY
```

## Running it

```bash
pnpm dev        # http://localhost:3000  (web app + /api/v1)
```

## Testing

```bash
pnpm typecheck            # tsc
pnpm lint
pnpm test                 # unit: crypto, filename validation, tokens, storage, rate limiting
pnpm test:integration     # web -> API -> Postgres round-trips (needs DATABASE_URL)
pnpm build                # production build, as Vercel runs it
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md). Short version: one Vercel project, root
directory `/`, four environment variables, `prisma migrate deploy` from CI or
your machine.

## Architecture notes

- **Storage**: encrypted file bytes live in Postgres (`storage_objects`).
  They are doubly encrypted — the browser's zero-knowledge AES-256-GCM
  ciphertext, wrapped again server-side under `STORAGE_ENCRYPTION_KEY` before
  being written (see [src/server/storage.ts](src/server/storage.ts)).
- **Authorization** is enforced on every project/file/version handler by
  checking `ownerId` against the authenticated session — mismatches return
  `404`, not `403`, so a project's existence can't be probed by id.
- **Versions are immutable**: restoring an old version creates a new version
  with a copy of the old (still-encrypted) bytes rather than mutating
  history — non-destructive, like a git revert.
- **Rate limiting** is Postgres-backed (fixed window), so it holds across
  concurrent serverless instances without Redis.
