# nvault security model

This document records the threat model and the specific design decisions
that implement it, so future changes can be checked against the original
intent instead of guessed at.

## Summary

nvault is a **zero-knowledge** vault: the server (API route handlers +
database) never has access to plaintext file contents, and never has access
to the key material needed to decrypt them. All encryption and decryption
happens client-side in the browser, using
[src/lib/crypto](src/lib/crypto). On top of that, the server adds a second
independent encryption layer over every stored blob (see "Storage encryption"
below) so that a database dump alone is inert.

## Key hierarchy (client-side, zero-knowledge)

```
Vault passphrase (user-chosen, never transmitted)
        │  PBKDF2-HMAC-SHA256, 600,000 iterations, random 128-bit salt
        ▼
Key Encryption Key (KEK)          — derived fresh on every unlock, never stored
        │  AES-256-GCM wrap, AAD = "master-key"
        ▼
Master Key                        — random 256 bits, generated once at signup
        │   (persisted server-side ONLY in wrapped form: kdfSalt, kdfIterations,
        │    wrappedMasterKey.{iv,ciphertext})
        │  AES-256-GCM wrap, AAD = "project:<clientGeneratedProjectId>"
        ▼
Project Data Key (one per project) — random 256 bits, generated on project creation
        │   (persisted server-side ONLY in wrapped form: wrappedProjectKey)
        │  AES-256-GCM encrypt, AAD = "<clientGeneratedContentId>"
        ▼
File version ciphertext            — leaves the browser as ciphertext
```

Every wrap/encrypt step binds an identifier as AEAD "additional authenticated
data" (AAD), so a ciphertext or wrapped key cannot be silently swapped onto a
different record without the AEAD tag check failing.

`kdfIterations` is stored per-user, so the PBKDF2 cost can be raised later
without breaking already-provisioned vaults (re-derivation happens
transparently on the next unlock).

## Storage encryption (server-side, defense in depth)

The ciphertext the browser uploads is encrypted **again** before it is
written to Postgres, under a 32-byte server key (`STORAGE_ENCRYPTION_KEY`)
that lives only in the deployment's environment, never in the database:

```
client ciphertext ──▶ AES-256-GCM(key = STORAGE_ENCRYPTION_KEY,
                                  AAD = storage key)
                  ──▶ [version:1][iv:12][gcmTag:16][ciphertext]  ──▶ storage_objects.data
```

See [src/server/storage.ts](src/server/storage.ts). Consequences:

- A stolen **database dump alone** reveals nothing — the server key is not in it.
- A dump **plus** the server key yields only the client ciphertext, which
  still needs the user's vault passphrase.
- The 1-byte format-version prefix lets the server key be rotated later
  behind a key-id without a silent format break. Rotating
  `STORAGE_ENCRYPTION_KEY` today invalidates existing blobs — it is a
  set-once secret per environment.

## Two independent secrets, on purpose

- **Account password** — authenticates *identity* to the server. Hashed with
  **Argon2id** (m = 46 MiB, t = 2, p = 1 — at/above OWASP 2024), checked
  server-side. Never used as key material. See
  [src/server/auth/password.ts](src/server/auth/password.ts).
- **Vault passphrase** — the only way to derive the KEK and unlock content.
  The server never sees it, never stores a hash of it, and cannot reset it.
  If it is lost, the encrypted files are unrecoverable, by design.

## What the server actually stores

- `users`: email, Argon2id password hash, `kdfSalt`, `kdfIterations`,
  `wrappedMasterKeyIv/Ciphertext`.
- `projects`: name, optional normalized git remote, `wrappedProjectKeyIv/Ciphertext`.
- `project_files` / `file_versions`: filename, version number, storage key,
  iv, `contentId`, plaintext size + sha256 (integrity/dedup display only — a
  hash is not reversible and is not key material).
- `storage_objects`: doubly-encrypted file bytes (client ciphertext wrapped
  again under the server key), keyed by server-generated storage keys.
- `sessions`: SHA-256 hash of the refresh token (never the raw token),
  IP/user-agent, timestamps.
- `rate_limit_hits`: `"<route>:<ip>"` + truncated window + count. No PII
  beyond the IP, pruned continuously.
- `audit_logs`: action name + non-secret metadata (a filename, a project
  name, a version number) — never file contents, never tokens.

Nothing in that list lets the operator of the API or database — or an
attacker who steals a full backup plus the server key — recover a single
plaintext secret without the user's vault passphrase.

## Why project/file IDs are client-generated

Wrapping a project key (or encrypting file content) needs an identifier to
bind as AAD *before* the server-side row exists — a chicken-and-egg problem
if IDs were server-assigned. `Project.id` and each version's `contentId` are
generated client-side (`crypto.randomUUID()`) so the AAD binding happens
atomically with encryption in a single request. UUIDv4 collisions are
handled as `409 Conflict` asking the client to retry.

## Path traversal

Storage keys are built exclusively from server-generated ids
(`projects/<projectId>/files/<fileId>/v<n>.bin`) — the user-supplied
filename is never part of a storage path. Filenames are additionally
validated against a strict allowlist
([src/lib/schemas/filename.ts](src/lib/schemas/filename.ts)) before being
persisted as metadata, as defense in depth. There is no filesystem and no
ZIP extraction on the server (the "download as ZIP" feature builds the
archive in the browser from already-decrypted files).

## Sessions

- Access tokens are short-lived JWTs (default 15 min, HS256 via `jose`) and
  are **re-checked against the sessions table on every request** — revoking a
  session takes effect immediately.
- Refresh tokens are opaque random values, stored only as a SHA-256 hash, in
  an httpOnly `SameSite=Lax` cookie scoped to `/api/v1/auth`. The cookie flow
  does **not** rotate the token on each refresh (the browser can fire several
  refreshes in one tick — Strict Mode, a 401 burst, multiple tabs — and a
  rotated token races cookie propagation, logging the user out). The token
  still expires (30 days, sliding) and a session can be revoked instantly.
  The non-cookie flow (for a future CLI) does rotate.
- Auth is deny-by-default: a route is public only if its handler never calls
  `requireAuth`.

## Rate limiting

`register`, `login`, and `refresh` are rate-limited by `"<route>:<ip>"` using
a Postgres fixed-window counter
([src/server/ratelimit.ts](src/server/ratelimit.ts)). Because the counter is
in the database, the limit holds across every concurrent serverless instance
without an external store. This is the deliberate trade for a Vercel-only,
no-Redis deployment: one small upsert per limited request.

## Transport & headers

Same-origin API (no CORS). Security headers (CSP `default-src 'self'`, HSTS,
`X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP) are set for
every route in [next.config.mjs](next.config.mjs).

## Known limitations (tracked, not accidental)

- **No MFA / passkeys / OAuth identity providers yet** — the auth service is
  structured so an additional identity provider doesn't require touching
  session, project, file, or encryption code.
- **No session cache** — revocation checks hit Postgres directly. Fine at
  this scale.
- **Vault passphrase changes** exist in the crypto layer (`rewrapMasterKey`,
  tested) but are not yet wired to a UI command.
- **`STORAGE_ENCRYPTION_KEY` rotation** is possible by format design (the
  version-prefix) but not yet implemented as a re-encrypt migration.
