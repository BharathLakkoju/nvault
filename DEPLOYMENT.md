# Deploying nvault

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
| `NEXT_PUBLIC_APP_URL` | the app's own origin (e.g. `https://vault.example.com`), used to build Polar redirect URLs |

Optional overrides: `JWT_ACCESS_TOKEN_TTL_SECONDS` (default 900),
`REFRESH_TOKEN_TTL_SECONDS` (default 2592000).

### Billing (Polar) — required in production

Paid plans billed through [Polar](https://polar.sh) as Merchant of Record
(Polar handles global sales tax / VAT and card data; nvault never sees a
card number):

- **Pro** — per-user subscription; lifts the personal-project cap to
  unlimited. Free stays at `FREE_LIMITS.maxPersonalProjects`
  ([src/server/billing/entitlements.ts](src/server/billing/entitlements.ts)).
- **Team** — per-organization subscription in one of three flat size tiers:
  Starter ($29, ≤10 members), Growth ($79, ≤25), Scale ($199, ≤100). Owners
  switch tiers in-app via `polar.subscriptions.update` (Polar prorates).

`env.ts` **fails the production build** unless all of these are set:

| Variable | How to get it |
|---|---|
| `POLAR_ACCESS_TOKEN` | Polar → Settings → Organization Access Token. Scopes: `checkouts:write`, `customer_sessions:write`, `subscriptions:read`, `subscriptions:write`, `products:read`. |
| `POLAR_PRO_PRODUCT_ID` | "nvault Pro" product, monthly recurring price; copy its id. |
| `POLAR_TEAM_STARTER_PRODUCT_ID` | "nvault Team Starter" product ($29/mo); copy its id. |
| `POLAR_TEAM_GROWTH_PRODUCT_ID` | "nvault Team Growth" product ($79/mo); copy its id. |
| `POLAR_TEAM_SCALE_PRODUCT_ID` | "nvault Team Scale" product ($199/mo); copy its id. |
| `POLAR_WEBHOOK_SECRET` | Polar → Webhooks → add endpoint `https://<your-app>/api/v1/webhooks/polar` subscribed to all `subscription.*` events; copy the signing secret. |
| `CRON_SECRET` | `openssl rand -hex 24` — Bearer secret for the daily purge cron (`vercel.json`). |

Optional: `POLAR_SERVER` (`sandbox` | `production`, default `sandbox`) and
the display-only price labels `PRO_PLAN_PRICE_LABEL`,
`TEAM_STARTER_PRICE_LABEL`, `TEAM_GROWTH_PRICE_LABEL`,
`TEAM_SCALE_PRICE_LABEL`.

Leaving the `POLAR_*` values unset in **local dev** disables the paywall
entirely — new orgs activate immediately on the largest tier and the
personal cap still applies but can't be upgraded past.

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

`vercel.json` also registers a **daily cron** (`03:00 UTC`) that hits
`/api/v1/internal/purge-pending-orgs` to delete organizations abandoned in
`PENDING_PAYMENT` for more than 7 days and prune never-completed pending Pro
checkouts. Vercel authenticates the cron by sending
`Authorization: Bearer $CRON_SECRET`.

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
cp .env.example .env            # fill in DB + JWT + storage key; leave POLAR_* blank
pnpm prisma migrate deploy
pnpm dev                        # http://localhost:3000
```

To exercise the real paywall locally, fill in the `POLAR_*` values against a
Polar **sandbox** org and forward webhooks to your machine (Polar dashboard
"Send test event", or a tunnel to `/api/v1/webhooks/polar`).
