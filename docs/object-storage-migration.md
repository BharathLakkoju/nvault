# Object storage migration plan

nvault currently stores encrypted file blobs in PostgreSQL (`storage_objects`).
This is deliberate for the MVP: one database, one Vercel project, no extra
infrastructure. It works well up to modest file counts and sizes, but it is not
the long-term scale ceiling.

## Current state

```text
Client ciphertext
       │
       ▼
Server wrap (STORAGE_ENCRYPTION_KEY)
       │
       ▼
storage_objects.data  (Postgres BYTEA)
```

Metadata (projects, files, versions, keys) already lives in Postgres. Only the
blob payload would move.

## Target state

```text
Client ciphertext
       │
       ▼
Server wrap (STORAGE_ENCRYPTION_KEY)
       │
       ▼
S3-compatible object store (e.g. R2, S3, GCS)
       │
       ▼
Postgres row keeps storageKey + AEAD metadata only
```

The domain layer (`src/server/storage.ts`, `src/server/files/service.ts`) is
already keyed by opaque `storageKey` strings — not filenames — so the
migration is primarily a storage-backend swap, not a schema redesign.

## Phased approach

### Phase 1 — Dual-write (no user impact)

1. Add a `StorageBackend` interface with `put`, `get`, `delete` implementations
   for Postgres (current) and object storage (new).
2. On upload, write to **both** backends; reads still come from Postgres.
3. Backfill existing blobs to object storage in batches (cron or one-off job),
   recording progress in a `storage_migrations` ledger keyed by `storageKey`.

### Phase 2 — Dual-read with fallback

1. Reads try object storage first; on miss, fall back to Postgres and
   opportunistically copy the blob forward (read-repair).
2. Monitor miss rate and copy lag until Postgres fallback is rare.

### Phase 3 — Object storage primary

1. Flip a feature flag (`STORAGE_PRIMARY=object`) so new uploads go only to
   object storage.
2. Stop dual-write to Postgres; keep Postgres blobs until the backfill ledger
   shows 100% copied and verified (SHA-256 of wrapped bytes).

### Phase 4 — Postgres blob retirement

1. Delete `storage_objects.data` for migrated keys (or drop the table if empty).
2. Optionally shrink the Postgres instance.

## Operational requirements

| Concern | Approach |
| --- | --- |
| Encryption | Keep server-side wrap unchanged; object store sees only wrapped bytes |
| Access control | Bucket private; server uses IAM credentials from env, never exposed to clients |
| Integrity | Compare `plaintextSha256` metadata + wrapped-byte hash after each copy |
| Rollback | Feature flag reverts reads to Postgres while dual-written data still exists |
| Vercel body limit | Unchanged — upload still passes through the API (2.5 MiB cap) |

## Environment variables (future)

| Variable | Purpose |
| --- | --- |
| `STORAGE_BACKEND` | `postgres` (default) \| `object` \| `dual` |
| `OBJECT_STORAGE_ENDPOINT` | S3-compatible endpoint URL |
| `OBJECT_STORAGE_BUCKET` | Bucket name |
| `OBJECT_STORAGE_ACCESS_KEY_ID` | IAM access key |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | IAM secret |

## When to execute

Trigger Phase 1 when any of these become true:

- Median encrypted blob size or total stored bytes threatens Postgres storage/IO budgets
- Upload/download p95 latency exceeds product targets under real load
- Backup/restore windows for the database become operationally painful

Until then, Postgres-backed blobs remain the supported production path.
