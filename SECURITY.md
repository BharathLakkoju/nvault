# EnvVault security model

This document records the threat model and the specific design decisions
that implement it, so future changes can be checked against the original
intent instead of guessed at.

## Summary

EnvVault is a **zero-knowledge** vault: the server (API + database + object
storage) never has access to plaintext file contents, and never has access
to the key material needed to decrypt them. All encryption and decryption
happens client-side, in the web app's browser context or in the CLI's Node
process, using `packages/crypto` — the single implementation shared by both
surfaces so their security properties can't drift apart.

## Key hierarchy

```
Vault passphrase (user-chosen, never transmitted)
        │  PBKDF2-HMAC-SHA256, 600,000 iterations, random 128-bit salt
        ▼
Key Encryption Key (KEK)          — derived fresh on every unlock, never stored
        │  AES-256-GCM wrap
        ▼
Master Key                        — random 256 bits, generated once at signup
        │  AES-256-GCM wrap, AAD = "master-key"
        ▼  (persisted server-side ONLY in wrapped form: kdfSalt, kdfIterations,
        │   wrappedMasterKey.{iv,ciphertext})
        │
        │  AES-256-GCM wrap, AAD = "project:<clientGeneratedProjectId>"
        ▼
Project Data Key (one per project) — random 256 bits, generated on project creation
        │  (persisted server-side ONLY in wrapped form: wrappedProjectKey)
        │
        │  AES-256-GCM encrypt, AAD = "<clientGeneratedContentId>"
        ▼
File version ciphertext            — persisted in the configured storage
                                      backend; database storage keeps opaque
                                      ciphertext bytes in Postgres, while
                                      object storage keeps them behind
                                      storageKey metadata
```

Every wrap/encrypt step binds an identifier as AEAD "additional authenticated
data" (AAD). This means a ciphertext or wrapped key cannot be silently
swapped onto a different record (e.g. the server returning project B's
wrapped key when the client asked for project A's) without the AEAD tag
check failing — the client detects tampering instead of silently decrypting
the wrong thing.

## Two independent secrets, on purpose

- **Account password** — authenticates *identity* to the server (argon2id
  hash, checked server-side). Never used as key material.
- **Vault passphrase** — the only way to derive the KEK and unlock content.
  The server never sees it, never stores a hash of it, and cannot reset it
  (there is no "forgot vault passphrase" flow that recovers data — if it's
  lost, the encrypted files are unrecoverable, by design).

Keeping these separate is what lets the CLI's device-authorization login
flow satisfy "never type your account password into the CLI" while still
supporting a real zero-knowledge unlock: the device flow only ever
transports *identity* tokens (access/refresh JWT-and-opaque-token pair),
never the vault passphrase or any key material. The CLI prompts locally,
per-command, for the vault passphrase and derives the master key entirely
in its own process memory — nothing related to encryption crosses the
device-authorization channel.

## What the server actually stores

- `users`: email, argon2id password hash, `kdfSalt`, `kdfIterations`,
  `wrappedMasterKeyIv/Ciphertext`.
- `projects`: name, optional normalized git remote, `wrappedProjectKeyIv/Ciphertext`.
- `project_files` / `file_versions`: filename, version number, storage key,
  iv, `contentId`, plaintext size + sha256 (for status/dedup display — a
  hash is not reversible and is not key material).
- `storage_objects`: optional Postgres-backed storage rows containing only
  opaque ciphertext bytes, keyed by server-generated storage keys.
- `sessions`: hashed refresh tokens (sha256, not the raw token), client type,
  device name, IP/user-agent, timestamps.
- `audit_logs`: action name + non-secret metadata (e.g. a filename, a
  project name, a version number) — never file contents, never tokens.

Nothing in that list allows the operator of the API, database, or object
storage — or an attacker who steals a full backup of all three — to recover
a single plaintext secret without the user's vault passphrase.

## Why project/file IDs are client-generated

Wrapping a project key (or encrypting file content) needs an identifier to
bind as AAD *before* the corresponding server-side row would normally be
created — a chicken-and-egg problem if IDs were server-assigned. Both
`Project.id` and each `FileVersion`'s `contentId` are generated client-side
(`crypto.randomUUID()`) precisely so the AAD binding can happen atomically
with encryption, in a single request, without a reserve-then-create
round trip. Collisions are astronomically unlikely (UUIDv4) and handled
as a `409 Conflict` asking the client to retry with a fresh id.

## Path traversal / zip-slip

Object storage keys are built exclusively from server-generated ids
(`projects/<projectId>/files/<fileId>/v<n>.bin`) — the user-supplied
filename is never part of a storage path. Filenames are additionally
validated against a strict allowlist (`packages/types/src/filename.ts`)
before being persisted as *metadata*, independent of the storage-key
scheme, as defense in depth. `LocalFsStorageProvider` also verifies every
resolved path stays under its configured root before touching the
filesystem.

## Session & device model

- Access tokens are short-lived JWTs (default 15 min) and are **re-checked
  against the sessions table on every request** — revoking a session takes
  effect immediately, it doesn't wait for the JWT to expire.
- Refresh tokens are opaque random values, stored only as a SHA-256 hash,
  and rotated on every use (old value stops working the instant a new one
  is issued).
- The CLI's device-authorization flow (RFC 8628-style) uses a short-lived,
  single-use `deviceCode`/`userCode` pair; approval requires the user to
  already be authenticated in a browser, and the code is consumed exactly
  once (replay of an already-consumed or expired code is rejected).

## Known MVP limitations (tracked, not accidental)

- **CLI credential storage** is a per-user config file with `chmod 600`
  permissions, not an OS keychain integration (Keychain/Credential
  Manager/libsecret). This only ever holds *identity* tokens (access +
  refresh), never the vault passphrase or master key — the blast radius of
  that file leaking is "attacker can call the API as this user," not
  "attacker can read secrets," since they'd still need the vault
  passphrase. OS-keychain integration is a natural follow-up.
- **No MFA/passkeys/OAuth identity providers yet** — `AuthService`/
  `UsersService` are structured so an additional identity provider doesn't
  require touching session, project, file, or encryption code.
- **No Redis/session cache** — session revocation checks hit Postgres
  directly. Fine at this scale; a cache would be a performance
  optimization, not a correctness requirement.
- **Vault passphrase changes** are implemented in the crypto layer
  (`rewrapMasterKey`) but not yet wired to a web/CLI command — the primitive
  exists and is tested; UI wiring is the next step, and per-user
  `kdfIterations` support means already-provisioned vaults aren't broken
  when the default increases.
