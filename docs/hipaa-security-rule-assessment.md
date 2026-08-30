# nvault — HIPAA Security Rule technical assessment

**Status:** internal engineering assessment, not a compliance certification.
**Date:** 2026-08-30.
**Scope:** the code in this repository (Next.js app + Route Handlers + Postgres
schema + published CLI). It does **not** cover the hosting accounts, legal
agreements, or company policies that HIPAA compliance also requires.

---

## 1. Bottom line

**"Is nvault HIPAA compliant?" — Not a question code can answer "yes" to.**

HIPAA compliance is an organizational program: a signed Business Associate
Agreement (BAA) with every customer that is a Covered Entity, BAAs *back-to-back*
with every subprocessor that can touch the data, a documented risk analysis,
workforce training, sanction policies, an incident-response and
breach-notification procedure, and periodic access reviews. None of that lives
in a Git repository.

What this repo *can* be judged on is the **technical safeguards** of the
Security Rule (45 CFR §164.312) and the parts of the administrative and
physical safeguards that are implemented in software. On that narrower question:

- **The encryption posture is strong and exceeds what HIPAA asks for.** HIPAA
  only makes encryption "addressable"; nvault does client-side zero-knowledge
  encryption (AES-256-GCM under a PBKDF2-600k-derived key) *plus* a second
  server-side envelope layer, and the server never holds plaintext or the keys
  to get it. See [SECURITY.md](../SECURITY.md).
- **Access control, audit logging, integrity, and transmission security are
  implemented** to a reasonable standard (details in §3).
- **There are real gaps** that must be closed before nvault could be offered
  under a BAA — most notably no MFA, no formal audit-log retention/tamper
  evidence, no documented backup/DR, and no subprocessor BAAs (§4).

### A note on what data is actually at risk here

nvault stores `.env` / configuration files. Those are not themselves medical
records, but a customer may store **credentials to systems that contain ePHI**
(a `DATABASE_URL` for a patient database, an EHR vendor API key, etc.). Under
the zero-knowledge design nvault cannot read those values. However, nvault
*does* hold, in the clear, identifiers that HIPAA treats as protected when tied
to an individual: **account email addresses** and **IP addresses** (in
`sessions`, `audit_logs`, `rate_limit_hits`). Those are the primary
PHI-adjacent surface the operator is responsible for.

---

## 2. How to read this document

Each Security Rule standard below is marked:

| Mark | Meaning |
|---|---|
| ✅ **Met (technical)** | Implemented in code to a defensible standard. |
| 🟡 **Partial** | Implemented but with a gap that needs work or a written policy. |
| ⬜ **Out of scope for code** | Requires a contract, policy, or hosting-account setting, not a code change. |
| ❌ **Gap** | Not implemented; needed before a BAA. |

---

## 3. §164.312 — Technical safeguards

### (a)(1) Access control

| Requirement | Status | Evidence / notes |
|---|---|---|
| Unique user identification (R) | ✅ Met | Every principal is a `User` row with a UUID; sessions and PATs are per-user rows. No shared accounts. |
| Emergency access procedure (R) | ⬜ Out of scope for code | Needs a documented break-glass process. By design there is **no operator recovery** of user content (zero-knowledge) — the emergency-access procedure is necessarily "the customer holds their own passphrase / Enrollment Secret". This must be written down and communicated. |
| Automatic logoff (A) | 🟡 Partial | Access tokens expire in 15 min and are re-checked against the `sessions` table every request; refresh tokens slide over 30 days. There is no idle-timeout that forces re-authentication (re-entry of the vault passphrase) after inactivity within a session. Consider a configurable idle lock for the web unlock state. |
| Encryption/decryption (A) | ✅ Met (exceeds) | Client-side AES-256-GCM zero-knowledge + server-side envelope. `src/lib/crypto`, `src/server/storage.ts`. |

Authorization is **deny-by-default** (`requireAuth` / `authorizeProject` /
`authorizeOrg`), re-derived from the database on every request, and returns
`404` (not `403`) for resources the caller can't see so existence can't be
probed. Cross-tenant isolation is covered by automated tests
(`tests/integration/leakage.spec.ts`, `scenarios.spec.ts`, `api.spec.ts`).

### (b) Audit controls

| Requirement | Status | Evidence / notes |
|---|---|---|
| Record and examine activity in systems with ePHI (R) | 🟡 Partial | `audit_logs` records ~40 action types (auth, session, project/file lifecycle, org membership, key rotation, billing) with non-secret metadata and the actor IP. Users can read their own log (`GET /audit-log`); org admins read the org's (`GET /organizations/:id/activity`). **Gaps:** (1) no retention policy or minimum retention period (HIPAA norm is 6 years for compliance documentation; audit data is usually kept 1+ year); (2) the table is mutable and not tamper-evident (no hash chain, no write-only sink, no export to an append-only store); (3) `file.downloaded` is logged but there is no alerting on anomalous access; (4) audit writes are best-effort (`try/catch`, failure only `console.error`) — an audit write failure does not fail the request. |

**Recommended before a BAA:** append-only replication of `audit_logs` to a
separate store (or a hash-chain column), a documented retention period, and a
switch to make security-critical audit writes blocking.

### (c)(1) Integrity

| Requirement | Status | Evidence / notes |
|---|---|---|
| Protect ePHI from improper alteration/destruction (R) | ✅ Met | Every wrap/encrypt binds an identifier as AEAD AAD, so ciphertext/keys can't be swapped between records without the GCM tag failing. `file_versions` stores `plaintextSha256` for client-side integrity checks. Versioning is **non-destructive** — restore creates a new version, nothing is overwritten. Membership removal + `rotate-key` is atomic with epoch bumped last. |
| Mechanism to authenticate ePHI (A) | ✅ Met | GCM tags on every layer; the client round-trips a nonce on unlock to confirm the server served the right RSA public key (anti-substitution). |

### (d) Person or entity authentication

| Requirement | Status | Evidence / notes |
|---|---|---|
| Verify identity before access (R) | 🟡 Partial | Password auth with **Argon2id (m=46 MiB, t=2, p=1**, at/above OWASP 2024), server-side. Sessions are short-lived JWTs re-checked every request; refresh tokens stored only as SHA-256. CLI uses opaque `evk_` PATs (SHA-256 at rest, per-request revocation check). **Gap: no MFA / passkeys / SSO.** For a system in scope for HIPAA, MFA on the web login is effectively expected. The auth layer is structured to add a provider without touching session/crypto code, but it isn't there yet. |

### (e)(1) Transmission security

| Requirement | Status | Evidence / notes |
|---|---|---|
| Guard against unauthorized access during transmission (R) | ✅ Met (in code) | Same-origin API, **no CORS**. Security headers set for every route in `next.config.mjs`: CSP `default-src 'self'`, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP. Secrets are never placed in URLs/query strings (asserted in `leakage.spec.ts`). TLS termination itself is the hosting platform's job (⬜ — verify HSTS preload + TLS 1.2+ only on the Vercel domain). |
| Encryption (A) | ✅ Met | Payloads are already ciphertext before they leave the browser; TLS is a second layer. |

---

## 4. §164.308 — Administrative safeguards (what's in code vs not)

| Standard | Status | Notes |
|---|---|---|
| (a)(1)(ii)(A) Risk analysis (R) | ❌ Gap | No formal, dated risk analysis document. [SECURITY.md](../SECURITY.md) is an excellent threat model and should be the seed of one, but a HIPAA risk analysis has a required structure (asset inventory, threat/vuln pairing, likelihood × impact, remediation plan). |
| (a)(1)(ii)(B) Risk management (R) | 🟡 Partial | Security decisions are documented and tested; there's no tracked risk register with owners and due dates. |
| (a)(3) Workforce security / (a)(4) Access management | ⬜ Out of scope for code | Who at the company can access the Vercel/Neon/Polar consoles, and their least-privilege roles, is an operational control. Note the DB console operator can read emails, IPs, and all ciphertext + `STORAGE_ENCRYPTION_KEY` (from Vercel env) — i.e. can obtain client ciphertext but still not plaintext. |
| (a)(5) Security awareness & training | ⬜ Out of scope for code | Policy. |
| (a)(6) Security incident procedures (R) | ❌ Gap | No documented incident-response runbook or breach-notification procedure (§164.400–414). Needed. |
| (a)(7) Contingency plan (R): data backup, disaster recovery, emergency mode | 🟡 Partial / ⬜ | Neon provides PITR, but there is no documented backup schedule, tested restore, RPO/RTO, or DR plan in this repo. `STORAGE_ENCRYPTION_KEY` loss = total data loss — its backup/escrow procedure must be documented. |
| (a)(8) Evaluation (R) | 🟡 Partial | The automated suites (`api.spec.ts`, `scenarios.spec.ts`, `leakage.spec.ts`, `tests/cli-integration/`) are a technical-controls evaluation and run the security-relevant paths. A periodic (annual) formal review and pen test are still needed. |
| (b)(1) **Business Associate contracts** (R) | ❌ Gap (critical) | nvault would be a Business Associate of any Covered Entity customer, and must (1) sign a BAA with that customer and (2) have BAAs with every subprocessor that stores or transmits the data: **Vercel, Neon (Postgres), Polar** (Polar only sees billing metadata + email, but that's still an identifier). Confirm each offers a BAA and on what plan tier. |

---

## 5. §164.310 — Physical safeguards

⬜ **Entirely delegated to subprocessors.** Facility access, workstation
security, and device/media disposal for the servers are Vercel's and Neon's
responsibility and are covered by their SOC 2 / ISO 27001 reports — obtain and
review those. The one code-adjacent item: there is **no server filesystem and
no ZIP extraction on the server** (the "download as ZIP" is built in the
browser), which removes a class of media-handling risk.

---

## 6. §164.316 — Documentation

🟡 The repo documents design and threat model well ([SECURITY.md](../SECURITY.md),
[PRD.md](../PRD.md), this file). HIPAA additionally requires the **policies and
procedures** themselves to be written, retained **6 years**, reviewed
periodically, and updated on environment changes. Those documents don't exist
yet.

---

## 7. Data-handling review — does the app abuse or leak user data?

Assessed against the code and locked into `tests/integration/leakage.spec.ts`
(build fails on any leak):

| Question | Finding |
|---|---|
| Are file contents ever readable by the server / operator / a DB thief? | **No.** Client-side encryption; server stores a re-enveloped blob. A DB dump is inert; a dump + `STORAGE_ENCRYPTION_KEY` yields only the client ciphertext, still gated by the user's passphrase. Verified: `storage_objects.data` has the `0x01` envelope prefix and contains none of the plaintext markers or the client ciphertext verbatim. |
| Do any API responses leak secrets, key material, or token values? | **No** (tested across `/auth/me`, project list/detail, file list, version history, file download, bulk export, sessions, CLI tokens, org detail, org activity, org billing, for owner/member/outsider). Token *hashes* are never selected into DTOs (`listSessions` uses an explicit allowlist `select`). |
| Does the audit log or activity feed store secrets? | **No.** `audit()`'s contract forbids it; metadata is filenames / names / version numbers / counts. The raw `audit_logs` rows are scanned in the test. IP addresses *are* stored (see below). |
| Are secrets ever put in URLs, query strings, or logs? | **No.** The only query param taking user input is `?url=` on `by-git-remote` (a git remote URL, explicitly not a secret). Server logs are captured during the whole leakage run and scanned — nothing sensitive is logged. |
| Do error responses leak internals (stack traces, SQL, driver errors)? | **No.** `handler()` converts any non-`ApiError` throw into an opaque `500`; validation errors report the field name only. Tested. |
| Is data sold, shared, or sent to third parties / analytics? | **No third-party analytics or trackers in the app.** Outbound calls: Polar (billing — receives email + opaque ids, no card data, no file data) and the customer's own Git binary locally (CLI). No advertising or data-broker integrations. |
| Cross-tenant access via ID manipulation? | **Blocked**, returns `404` (not `403`), no data in the body. Tested for projects, files, versions, orgs, and org-billing across unrelated accounts. |
| Minimum-necessary / data minimization | Reasonable. Stored PII is limited to email + IP + user-agent. `rate_limit_hits` holds `"<route>:<ip>"` and is pruned continuously. **Gap:** no defined retention/expiry for `audit_logs` IP addresses or for `sessions` rows after revocation. |

### The IP-address question

`sessions`, `audit_logs`, and `rate_limit_hits` store client IP addresses.
Under HIPAA an IP address tied to an individual is an identifier. Recommended:
(1) a retention limit (e.g. truncate/expire audit IPs after N days),
(2) document why they're collected (security / abuse prevention — a legitimate
purpose), (3) include them in the risk analysis and the privacy notice.

---

## 8. Prioritized gap list (what to do before offering nvault under a BAA)

**Must have (blockers):**

1. **BAAs** — with customers (as BA) and with Vercel, Neon, and Polar (as
   subprocessors). Confirm plan tiers that include a BAA.
2. **MFA** on web login (TOTP or passkeys). Auth layer is ready for it.
3. **Written risk analysis** (seed from SECURITY.md) and a **risk register**.
4. **Incident-response + breach-notification procedure** (§164.400–414).
5. **Contingency plan**: documented + tested backup/restore, RPO/RTO,
   `STORAGE_ENCRYPTION_KEY` escrow procedure.
6. **Audit-log hardening**: retention period, tamper-evidence (hash chain or
   append-only replica), make security-critical audit writes blocking.

**Should have:**

7. Configurable **idle re-lock** for the web vault-unlock state.
8. **Retention/expiry** for IP addresses in `audit_logs` and stale `sessions`
   rows; document collection purpose in the privacy notice.
9. **Access reviews** for the hosting consoles (quarterly), least-privilege
   roles, MFA on those accounts.
10. Written **policies & procedures** set per §164.316 with a 6-year retention.
11. Annual **third-party penetration test** and controls review.

**Already strong (keep):**

- Zero-knowledge client-side encryption + server envelope layer.
- Deny-by-default authz re-checked every request; 404-not-403 isolation.
- Argon2id password hashing; short-lived, individually-revocable sessions.
- No card data; no third-party analytics; no server filesystem.
- Automated leakage + isolation + scenario test suites gating the build.

---

## 9. How the automated evidence maps to this assessment

| Control area | Test file |
|---|---|
| No plaintext/secret/key leak on any API, log, audit, or storage surface | `tests/integration/leakage.spec.ts` |
| Every persona in `docs/test-scenarios.md` (Free/Pro/Team caps, roles, isolation) | `tests/integration/scenarios.spec.ts` |
| Encryption round-trip, envelope-at-rest, versioning, webhook auth, key rotation, RBAC | `tests/integration/api.spec.ts` |
| CLI: auth, credential storage (0600), byte preservation, no-disk `run` injection, revocation | `tests/cli-integration/*.spec.ts` |
| Crypto primitives (KDF, AEAD, envelope, asymmetric, roster) | `src/lib/crypto/*.spec.ts` |

Run: `pnpm test` (unit) · `pnpm test:integration` · `pnpm test:cli:integration`
(the integration suites need `DATABASE_URL`; see `tests/integration/setup.ts`).
