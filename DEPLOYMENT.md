# Deploying EnvVault

One Next.js app, one Vercel project, one Postgres database. Nothing else.
See [SECURITY.md](./SECURITY.md) for the threat model behind the choices
below (why the request body cap is what it is, what the server storage key
protects).

## 1. Database

Create a Postgres database (Neon or Supabase both have a usable free tier).
You need two connection strings:

- **Pooled** (`DATABASE_URL`) — the app uses this at runtime. On serverless,
  each invocation can open a fresh connection; an unpooled URL exhausts the
  database's connection limit fast. Use the provider's pooled / PgBouncer
  endpoint.
- **Direct / unpooled** (`DIRECT_DATABASE_URL`) — used only by
  `prisma migrate`.

On a plain local Postgres, both are the same string.

## 2. Environment variables

| Variable | How to get it |
|---|---|
| `DATABASE_URL` | pooled connection string (step 1) |
| `DIRECT_DATABASE_URL` | direct connection string (step 1) |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` — min 32 chars |
| `STORAGE_ENCRYPTION_KEY` | `openssl rand -base64 32` — exactly 32 bytes, base64. **Set once and never change it** — rotating it makes every stored file blob unreadable. |

Optional overrides: `JWT_ACCESS_TOKEN_TTL_SECONDS` (default 900),
`REFRESH_TOKEN_TTL_SECONDS` (default 2592000).

## 3. Run the migrations

Vercel does not run migrations for you. From your machine or CI, pointed at
the **direct** URL:

```bash
DATABASE_URL="$DIRECT_DATABASE_URL" pnpm prisma migrate deploy
```

## 4. Deploy to Vercel

1. Import the repo. **Root Directory: `/`** (this is a single app).
2. Framework preset: Next.js (auto-detected). Build command `pnpm run build`
   (runs `prisma generate` then `next build`) and install command
   `pnpm install --frozen-lockfile` are set in `vercel.json`.
3. Add the environment variables from step 2 (Production + Preview).
4. Deploy.

The API is served by the same deployment under `/api/v1/*` as serverless
functions (`maxDuration: 30s`). No second project, no CORS, no object
storage.

### Platform constraint

Vercel's Node runtime enforces a hard **~4.5 MB request body limit that
cannot be raised**. `MAX_FILE_SIZE_BYTES` in
[src/lib/schemas/dto.ts](src/lib/schemas/dto.ts) is 2.5 MiB so that a
base64-encoded ciphertext body always stays comfortably under that. The
upload route rejects anything larger with `413` before touching the
database.

## 5. Verify

- `GET https://<your-app>/api/v1/health` → `{"status":"ok",...}`
- Register an account, unlock the vault, create a project, upload a `.env`,
  download it back, confirm the bytes match.
- `pnpm test:integration` against the same database exercises the whole
  web → API → Postgres path (register → project → upload → download →
  version → restore → cross-user isolation → path-traversal rejection).

## Local development

```bash
docker compose up -d postgres
cp .env.example .env            # fill in the 4 values
pnpm prisma migrate deploy
pnpm dev                        # http://localhost:3000
```
