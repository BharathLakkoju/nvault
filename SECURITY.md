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

## Organizations (shared projects, still zero-knowledge)

A project belongs to **either** one user **or** one organization. Personal
projects (Free/Pro) are unchanged: the project key is wrapped under the
owner's master key, which is derived from the owner's **user-chosen vault
passphrase**. Organizations do **not** use a member's personal passphrase —
each org has its own machine-generated secret, so a user in several orgs
holds several independent keys and unlocking one org tells you nothing about
another.

Org projects introduce these layers, all client-side:

```
(A) Organization Enrollment Secret (OES) — 128-bit, generated in the
    creator's browser, shown once, shared with each invitee OUT-OF-BAND
        │  PBKDF2-SHA256 → KEK,  AES-256-GCM unwrap, AAD "org-enrollment"
        ▼
Organization Key (random 256 bits, one per org, per epoch)
  · persisted as ciphertext TWO ways:
      – wrapped under the OES KEK          (organizations.enrollmentWrappedOrgKey*)
      – wrapped once per member to that member's RSA public key
                                           (organization_memberships.wrappedOrgKeyCiphertext)
        │  AES-256-GCM wrap, AAD "project:<projectId>"
        ▼
Org project data key  ──▶  file version ciphertext  (unchanged)

(B) Per-user RSA-OAEP-3072 keypair — public key cleartext (users.publicKey),
    private key AES-256-GCM wrapped under the user's master key (AAD
    "user-privkey"). Used for the per-member Org Key copy and for rotation.

(C) Encrypted member roster — {userId → SHA-256(their SPKI public key)},
    AES-256-GCM under the Org Key (AAD "org-roster"), monotonic
    `rosterVersion`. Each member writes their own entry, from their LOCAL
    keypair, as they enroll.
```

Consequences and deliberate decisions:

- **The server is not in the key-delivery path.** A new member obtains the
  Org Key by entering the OES — the server never sees the secret and supplies
  no key material the client has to trust. There is no admin "grant" step and
  no server-held public key that a malicious server could substitute at
  enrollment.
- **The server never holds an unwrapped Org Key or org project key.** No
  endpoint returns one. `enroll` and `rotate-key` payloads are opaque
  ciphertext produced in the browser.
- **Joining is: invite → accept → enroll.** Accepting an invite creates an
  `INVITED` membership with no key (and the API hides org projects from it).
  The member then enters the OES; their client recovers the Org Key,
  re-wraps it to their own public key, and pins their key fingerprint in the
  roster — flipping them to `ACTIVE`. Concurrent enrollments are serialised by
  `rosterVersion` (optimistic concurrency, enforced server-side).
- **Rotation is pin-checked.** Before `rotate-key`, the admin's client
  decrypts the roster and compares every active member's *served* public key
  to its pinned fingerprint; a mismatch aborts the rotation
  (`RosterKeyMismatch`) rather than wrapping the new Org Key to a substituted
  key. Rotation issues a **new OES** (the old one can no longer unwrap
  anything); existing members are re-keyed silently via their RSA copy and
  need not re-enter anything.
- **The client verifies its own keypair on unlock.** The wrapped private key
  is authenticated under the master key (unforgeable by the server); the
  client round-trips a nonce to confirm the served `publicKey` is its
  counterpart, so a server that swapped only the public key is caught.
- **Removal + rotation.** Deleting a membership cuts API access immediately
  (every project/file route re-derives access from `organization_memberships`
  on each request, 404 on no-access — never 403, so neither a project nor an
  org can be probed by id). To also revoke a removed member's ability to
  decrypt blobs they already downloaded or could re-download, an admin runs
  `rotate-key`: a fresh Org Key, every org project key and every remaining
  member's Org Key re-wrapped under it, a fresh OES, the roster re-encrypted,
  `currentKeyEpoch` bumped **last** so a partial failure leaves clients on the
  old (working) epoch. The server enforces that a rotation covers *exactly*
  the current project set and active-membership set.
- **Invite tokens** (`oiv_…`) are 256-bit, stored only as sha256, single-use,
  expire in 7 days, are bound to the invitee's exact account email (a leaked
  link can't be redeemed by another account), and are rate-limited per org
  and per IP. The invite link alone grants nothing — enrollment also needs
  the OES, which must travel a separate channel.
- **Role hierarchy** `OWNER > ADMIN > MEMBER`: an actor can only assign or
  act on roles strictly below their own (OWNER excepted). The last OWNER
  cannot be demoted, removed, or leave. Ownership transfer promotes the
  target before demoting the outgoing owner (never zero owners).
- **Residual risks (documented, not accidental):**
  - **OES distribution is the owner's responsibility.** If the owner sends
    the enrollment secret over the same channel as the invite link, a passive
    observer of that channel gets both. The UI keeps the two apart and warns,
    but cannot enforce the out-of-band requirement.
  - A member removed *before* a key rotation keeps whatever plaintext they
    had already decrypted locally, and also still knows the pre-rotation OES.
    Rotation issues a new OES and new Org Key, limiting this to "what they had
    already seen". This is true of every cryptographic access-revocation
    scheme.
  - A buggy/malicious member who has enrolled can submit a garbage roster edit
    or `wrappedOrgKey`. The server cannot verify either without breaking
    zero-knowledge. Impact is a denial of service (they lock themselves out,
    or — for the roster — force an admin to rebuild it); never disclosure.
    All enroll/rotate actions are audited.
  - A CLI Personal Access Token inherits all of the user's org access.
    Org-scoped tokens are a future addition.
  - `POST /auth/vault/keypair` is **write-once** — a stolen session cannot
    swap a user's keypair (which would lock them out of orgs / enable a
    rotation MITM). Rotating a keypair intentionally is a future, audited
    re-key flow.
  - **The web app ships the crypto code from the server.** A server that
    serves backdoored JavaScript defeats any client-side scheme. The published,
    version-pinned CLI is the surface that can meaningfully resist an
    untrusted server; the web app is best-effort. Compromised member devices
    and malicious members are out of scope for the key design.

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
- **Vault passphrase** — the only way to derive the KEK and unlock a user's
  own (personal / Free / Pro) content. The server never sees it, never stores
  a hash of it, and cannot reset it. If it is lost, the encrypted files are
  unrecoverable, by design.
- **Organization Enrollment Secret** — one per organization, machine-generated
  (128-bit), used only to hand the Org Key to new members. Not derived from
  and not related to any user's vault passphrase. The server never sees it;
  losing it (with no active member left to rotate) makes the org's files
  unrecoverable.

## What the server actually stores

- `users`: email, Argon2id password hash, `kdfSalt`, `kdfIterations`,
  `wrappedMasterKeyIv/Ciphertext`.
- `projects`: name, optional normalized git remote, `wrappedProjectKeyIv/Ciphertext`,
  optional `organizationId` + `keyEpoch`.
- `users` (cont.): optional `publicKey` (cleartext SPKI) + `wrappedPrivateKey*` (ciphertext).
- `organizations` / `organization_memberships` / `organization_invites` /
  `organization_key_epochs`: org metadata, roles, per-member **wrapped** Org
  Key ciphertext, the OES-wrapped Org Key + its KDF params, the encrypted
  member roster + `rosterVersion`, per-member pinned public key, sha256 of
  invite tokens, key-rotation history. No plaintext key material, no
  enrollment secret.
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

`register`, `login`, `refresh`, org invite creation, invite acceptance, and
the billing checkout / portal endpoints are rate-limited by `"<route>:<ip>"`
(invite creation additionally per org; billing additionally per user)
using a Postgres fixed-window counter
([src/server/ratelimit.ts](src/server/ratelimit.ts)). Because the counter is
in the database, the limit holds across every concurrent serverless instance
without an external store. This is the deliberate trade for a Vercel-only,
no-Redis deployment: one small upsert per limited request.

## Billing (Polar)

Paid plans (Pro — per user, raises the personal-project cap; Team — per
organization in three flat size tiers, unlocks shared projects).
Security-relevant properties:

- **No card data touches nvault.** Checkout and the customer portal are
  Polar-hosted pages; the server only ever stores opaque ids
  (`polarCustomerId`, `polarSubscriptionId`) and a coarse status enum. The
  `Subscription` table holds no secrets.
- **The paywall is an authorization control, enforced server-side.**
  `authorizeOrg` / `authorizeProject`
  ([src/server/authz](src/server/authz)) return `402` for a
  `PENDING_PAYMENT` org (all access) and for writes to a `SUSPENDED` org;
  `createProject` enforces the free-tier personal-project cap (checking the
  caller's live Pro status); `createInvite` enforces the org's Team-tier
  member cap. The client's banners and disabled buttons are cosmetic —
  every gate is re-checked on the API.
- **Webhook authenticity** is the Standard Webhooks HMAC over
  `${id}.${timestamp}.${body}`, verified against `POLAR_WEBHOOK_SECRET`
  before any state change
  ([src/server/billing/polar.ts](src/server/billing/polar.ts)). The endpoint
  has no bearer auth by design; a bad or missing signature is `400`.
  Deliveries are de-duplicated by `webhook-id` (`ProcessedWebhookEvent`), and
  the id is recorded only after the effect succeeds, so a transient failure
  stays replayable.
- **Non-payment never destroys data.** A lapsed subscription drops the org
  to `SUSPENDED` (read-only) and keeps every blob. The only automatic
  deletion is the 7-day purge of orgs that were *never* paid for
  (`PENDING_PAYMENT`), which by construction cannot hold any projects.
- **CSP is unaffected**: checkout is a top-level navigation to `polar.sh`
  (not an iframe or `fetch`), and server→Polar API calls are not subject to
  the browser CSP.
- The cron purge endpoint is gated by a constant-time compare against
  `CRON_SECRET`.

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
