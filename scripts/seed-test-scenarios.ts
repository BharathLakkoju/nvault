/**
 * Test-scenario seed harness.
 *
 *   pnpm seed:scenarios
 *
 * DANGER: this TRUNCATES every user-facing table in the database that
 * DATABASE_URL points at, then re-seeds a fixed set of accounts — one per
 * product scenario worth exercising (Free-tier caps, Pro entitlement states,
 * Team org billing states, org membership/enrollment states). It is NOT part
 * of the normal test run (see jest.seed.config.cjs).
 *
 * Everything is built with the real crypto (`src/lib/crypto`) and the real
 * server service layer, so the seeded rows are indistinguishable from ones a
 * browser/CLI client would produce: vaults unlock, org keys decrypt, file
 * blobs round-trip. The only shortcut is billing — Polar is never contacted;
 * Subscription rows and Organization.status are written directly, exactly as
 * the `subscription.*` webhook would.
 *
 * After seeding it writes docs/test-scenarios.md (the email → scenario map).
 *
 * Shared credentials for every seeded account:
 *   account password : see ACCOUNT_PASSWORD below
 *   vault passphrase  : see VAULT_PASSPHRASE below
 */
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import * as vc from "@/lib/crypto";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { generateOpaqueToken, hashToken } from "@/server/auth/tokens";
import { createApiToken } from "@/server/auth/api-tokens";
import { createUser } from "@/server/users";
import { createProject } from "@/server/projects/service";
import { uploadVersion } from "@/server/files/service";
import { createOrganization } from "@/server/organizations/service";
import { acceptInvite, createInvite } from "@/server/organizations/invites";
import { enrollMember } from "@/server/organizations/enroll";
import type { SubscriptionStatus, SubscriptionTier } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Shared credentials
// ---------------------------------------------------------------------------
//
// One login password + one vault passphrase for every seeded account. Never
// hardcoded — each run takes them from the environment, or falls back to a
// fresh random value with no string literal for a scanner to flag. The
// effective values are written to the git-ignored docs/test-scenarios.local.md
// and printed to the console.

const ACCOUNT_PASSWORD =
  process.env.SEED_ACCOUNT_PASSWORD || randomBytes(24).toString("base64url");
const VAULT_PASSPHRASE =
  process.env.SEED_VAULT_PASSPHRASE || randomBytes(24).toString("base64url");
const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Scenario record (drives the generated doc)
// ---------------------------------------------------------------------------

interface Scenario {
  email: string;
  label: string;
  scenario: string;
  facts: string[];
  /** Per-account extra secrets (CLI token, enrollment secret, invite link). */
  secrets?: Record<string, string>;
}
const scenarios: Scenario[] = [];
const record = (s: Scenario) => scenarios.push(s);

// ---------------------------------------------------------------------------
// Builders (real crypto + real services)
// ---------------------------------------------------------------------------

interface SeededUser {
  id: string;
  email: string;
  masterKey: Uint8Array;
  sessionId: string;
  publicKey?: string;
  privateKey?: Uint8Array;
}

async function makeUser(
  email: string,
  opts: { name?: string; keypair?: boolean } = {},
): Promise<SeededUser> {
  const prov = await vc.provisionVault(VAULT_PASSPHRASE);
  const passwordHash = await hashPassword(ACCOUNT_PASSWORD);
  const user = await createUser({
    email: email.toLowerCase(),
    passwordHash,
    name: opts.name,
    kdfSalt: prov.keyMaterial.kdfSalt,
    kdfIterations: prov.keyMaterial.kdfIterations,
    wrappedMasterKey: prov.keyMaterial.wrappedMasterKey,
  });

  const session = await db.session.create({
    data: {
      userId: user.id,
      userAgent: "seed-scenarios (primary browser session)",
      ipAddress: "127.0.0.1",
      refreshTokenHash: hashToken(generateOpaqueToken()),
      expiresAt: new Date(Date.now() + 30 * DAY),
    },
  });

  const seeded: SeededUser = {
    id: user.id,
    email: user.email,
    masterKey: prov.masterKey,
    sessionId: session.id,
  };

  if (opts.keypair) {
    const kp = await vc.provisionUserKeyPair(prov.masterKey);
    await db.user.update({
      where: { id: user.id },
      data: {
        publicKey: kp.material.publicKey,
        wrappedPrivateKeyIv: kp.material.wrappedPrivateKey.iv,
        wrappedPrivateKeyCiphertext: kp.material.wrappedPrivateKey.ciphertext,
      },
    });
    seeded.publicKey = kp.material.publicKey;
    seeded.privateKey = kp.privateKey;
  }

  return seeded;
}

async function addBrowserSession(userId: string, label: string, lastUsedAt: Date) {
  await db.session.create({
    data: {
      userId,
      userAgent: `seed-scenarios (${label})`,
      ipAddress: "127.0.0.1",
      refreshTokenHash: hashToken(generateOpaqueToken()),
      lastUsedAt,
      expiresAt: new Date(Date.now() + 30 * DAY),
    },
  });
}

async function uploadFile(
  projectId: string,
  projectKey: Uint8Array,
  filename: string,
  text: string,
  sessionId: string,
  unlimited: boolean,
) {
  const bytes = vc.utf8ToBytes(text);
  const contentId = randomUUID();
  const payload = await vc.encryptFileContent(projectKey, contentId, bytes);
  return uploadVersion(
    projectId,
    {
      filename,
      payload,
      contentId,
      plaintextSize: bytes.length,
      plaintextFingerprint: await vc.fileFingerprintHex(projectKey, bytes),
    },
    sessionId,
    { unlimited },
  );
}

interface FileSpec {
  filename: string;
  /** One entry per version (oldest first). */
  versions: string[];
}

async function addPersonalProject(
  user: SeededUser,
  name: string,
  files: FileSpec[] = [],
  opts: { unlimited?: boolean } = {},
) {
  const id = randomUUID();
  const { wrappedProjectKey, projectKey } = await vc.createProjectKey(user.masterKey, id);
  await createProject(user.id, { id, name, wrappedProjectKey });
  for (const file of files) {
    for (const text of file.versions) {
      await uploadFile(id, projectKey, file.filename, text, user.sessionId, opts.unlimited ?? false);
    }
  }
  return { id, projectKey };
}

async function grantProSubscription(userId: string, status: SubscriptionStatus) {
  const shortId = userId.slice(0, 8);
  await db.subscription.create({
    data: {
      plan: "PRO",
      ownerUserId: userId,
      status,
      polarCustomerId: `cus_seed_${shortId}`,
      polarSubscriptionId: `sub_seed_pro_${shortId}`,
      polarProductId: process.env.POLAR_PRO_PRODUCT_ID ?? "prod_pro_seed",
      currentPeriodEnd: new Date(Date.now() + (status === "CANCELED" ? -2 : 28) * DAY),
      cancelAtPeriodEnd: status === "CANCELED",
    },
  });
}

interface SeededOrg {
  orgId: string;
  orgKey: Uint8Array;
  secret: string;
  slug: string;
  owner: SeededUser;
}

async function makeOrg(
  owner: SeededUser,
  name: string,
  slug: string,
  tier: SubscriptionTier,
): Promise<SeededOrg> {
  const orgKey = vc.generateDataKey();
  const wrappedOrgKeyCiphertext = await vc.wrapToPublicKey(owner.publicKey!, orgKey);
  const secret = vc.generateEnrollmentSecret();
  const enrollment = await vc.wrapOrgKeyWithEnrollmentSecret(orgKey, secret);
  const roster = vc.withEntry(vc.emptyRoster(), owner.id, {
    fingerprint: await vc.fingerprintPublicKey(owner.publicKey!),
    addedAt: new Date().toISOString(),
  });
  const rosterBlob = await vc.encryptRoster(orgKey, roster);

  const org = await createOrganization(owner.id, {
    name,
    slug,
    wrappedOrgKeyCiphertext,
    enrollment,
    roster: rosterBlob,
    pinnedPublicKey: owner.publicKey!,
    tier,
  });

  return { orgId: org.id, orgKey, secret, slug, owner };
}

/** Mirrors the `subscription.active` webhook effect. */
async function activateOrg(orgId: string, tier: SubscriptionTier) {
  const shortId = orgId.slice(0, 8);
  await db.subscription.update({
    where: { organizationId: orgId },
    data: {
      status: "ACTIVE",
      tier,
      polarCustomerId: `cus_seed_org_${shortId}`,
      polarSubscriptionId: `sub_seed_team_${shortId}`,
      polarProductId: `prod_team_${tier.toLowerCase()}_seed`,
      currentPeriodEnd: new Date(Date.now() + 28 * DAY),
    },
  });
  await db.organization.update({ where: { id: orgId }, data: { status: "ACTIVE" } });
}

/** Mirrors the `subscription.past_due` webhook effect. */
async function suspendOrg(orgId: string) {
  await db.subscription.update({
    where: { organizationId: orgId },
    data: { status: "PAST_DUE", currentPeriodEnd: new Date(Date.now() - 2 * DAY) },
  });
  await db.organization.update({ where: { id: orgId }, data: { status: "SUSPENDED" } });
}

async function ownerMembershipOf(org: SeededOrg) {
  return db.organizationMembership.findUniqueOrThrow({
    where: { organizationId_userId: { organizationId: org.orgId, userId: org.owner.id } },
  });
}

/** invite + accept; optionally recover the Org Key and enroll (status ACTIVE). */
async function addMember(
  org: SeededOrg,
  invitee: SeededUser,
  role: "ADMIN" | "MEMBER",
  enroll: boolean,
) {
  const invite = await createInvite(org.orgId, await ownerMembershipOf(org), {
    email: invitee.email,
    role,
  });
  await acceptInvite(invitee.id, invitee.email, invite.token);
  if (!enroll) return;

  const orgRow = await db.organization.findUniqueOrThrow({ where: { id: org.orgId } });
  const currentRoster = await vc.decryptRoster(org.orgKey, {
    iv: orgRow.rosterIv,
    ciphertext: orgRow.rosterCiphertext,
  });
  const nextRoster = vc.withEntry(currentRoster, invitee.id, {
    fingerprint: await vc.fingerprintPublicKey(invitee.publicKey!),
    addedAt: new Date().toISOString(),
  });
  await enrollMember(org.orgId, invitee.id, {
    wrappedOrgKey: await vc.wrapToPublicKey(invitee.publicKey!, org.orgKey),
    keyEpoch: orgRow.currentKeyEpoch,
    pinnedPublicKey: invitee.publicKey!,
    roster: await vc.encryptRoster(org.orgKey, nextRoster),
    expectedRosterVersion: orgRow.rosterVersion,
  });
}

/** creates a still-pending (un-accepted) invite; returns the raw link token. */
async function pendingInvite(org: SeededOrg, email: string, role: "ADMIN" | "MEMBER") {
  const invite = await createInvite(org.orgId, await ownerMembershipOf(org), {
    email: email.toLowerCase(),
    role,
  });
  return invite.token;
}

async function addOrgProject(
  owner: SeededUser,
  org: SeededOrg,
  name: string,
  file?: { filename: string; contents: string },
) {
  const id = randomUUID();
  const { wrappedProjectKey, projectKey } = await vc.createProjectKey(org.orgKey, id);
  await createProject(owner.id, { id, name, wrappedProjectKey, organizationId: org.orgId });
  if (file) await uploadFile(id, projectKey, file.filename, file.contents, owner.sessionId, true);
}

// ---------------------------------------------------------------------------
// Wipe
// ---------------------------------------------------------------------------

const COUNTABLE = [
  "user",
  "session",
  "project",
  "projectFile",
  "fileVersion",
  "storageObject",
  "organization",
  "organizationMembership",
  "organizationInvite",
  "organizationKeyEpoch",
  "subscription",
  "auditLog",
  "processedWebhookEvent",
  "rateLimitHit",
] as const;

async function snapshotCounts() {
  const out: Record<string, number> = {};
  for (const model of COUNTABLE) {
    out[model] = await (db as unknown as Record<string, { count: () => Promise<number> }>)[
      model
    ].count();
  }
  return out;
}

async function wipeEverything() {
  // Child → parent. Most FKs cascade at the DB level, but explicit ordering
  // keeps this readable and independent of the constraint definitions.
  await db.fileVersion.deleteMany();
  await db.projectFile.deleteMany();
  await db.storageObject.deleteMany();
  await db.project.deleteMany();
  await db.organizationInvite.deleteMany();
  await db.organizationKeyEpoch.deleteMany();
  await db.organizationMembership.deleteMany();
  await db.subscription.deleteMany();
  await db.auditLog.deleteMany();
  await db.session.deleteMany();
  await db.organization.deleteMany();
  await db.user.deleteMany();
  await db.processedWebhookEvent.deleteMany();
  await db.rateLimitHit.deleteMany();
}

// ---------------------------------------------------------------------------
// .env sample contents (formatting/comments/quotes preserved verbatim on store)
// ---------------------------------------------------------------------------

const ENV_V1 = `# nvault seed fixture — safe placeholder values only
NODE_ENV=development
DATABASE_URL="postgres://user:pass@localhost:5432/app?schema=public"
API_KEY=seed-placeholder-000
FEATURE_FLAGS="a,b,c"
`;
const ENV_V2 = ENV_V1.replace("API_KEY=seed-placeholder-000", "API_KEY=seed-placeholder-001").replace(
  'FEATURE_FLAGS="a,b,c"',
  'FEATURE_FLAGS="a,b,c,d"',
);
const ENV_V3 = ENV_V2.replace("API_KEY=seed-placeholder-001", "API_KEY=seed-placeholder-002");
const ENV_PROD = `# production-shaped placeholder — no real secrets
NODE_ENV=production
LOG_LEVEL=info
CACHE_TTL_SECONDS=3600
`;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  // ===== Free tier =======================================================

  await makeUser("free-newcomer@nvault.test", { name: "Free Newcomer" });
  record({
    email: "free-newcomer@nvault.test",
    label: "Free · brand-new account",
    scenario: "Empty Free account — no vault keypair, no projects, one browser session.",
    facts: [
      "Free plan (no subscription row)",
      "No RSA keypair yet (cannot create/join an organization)",
      "0 projects — baseline for first-run / empty-state UI",
    ],
  });

  const freeActive = await makeUser("free-active@nvault.test", { name: "Free Active", keypair: true });
  await addPersonalProject(freeActive, "portfolio-site", [
    { filename: ".env", versions: [ENV_V1, ENV_V2] },
    { filename: ".env.production", versions: [ENV_PROD] },
  ]);
  await addPersonalProject(freeActive, "cli-tool", [{ filename: ".env.local", versions: [ENV_V1] }]);
  record({
    email: "free-active@nvault.test",
    label: "Free · normal usage",
    scenario: "Healthy Free account well under every cap — 2 projects, one file with version history.",
    facts: [
      "Free plan",
      "RSA keypair provisioned",
      "2 / 3 personal projects; `.env` in portfolio-site has 2 versions (cap is 2 — at the limit)",
    ],
  });

  const freeProjectsMaxed = await makeUser("free-projects-maxed@nvault.test", {
    name: "Free Projects Maxed",
  });
  for (const name of ["alpha", "beta", "gamma"]) {
    await addPersonalProject(freeProjectsMaxed, name, [{ filename: ".env", versions: [ENV_V1] }]);
  }
  record({
    email: "free-projects-maxed@nvault.test",
    label: "Free · at personal-project cap",
    scenario: "Free account holding exactly 3 personal projects — creating a 4th must 402.",
    facts: [
      "Free plan",
      "3 / 3 personal projects (FREE_LIMITS.maxPersonalProjects)",
      "Expected: POST /projects → 402 'Upgrade to Pro'",
    ],
  });

  const freeVersionsMaxed = await makeUser("free-versions-maxed@nvault.test", {
    name: "Free Versions Maxed",
  });
  await addPersonalProject(freeVersionsMaxed, "web-app", [
    { filename: ".env", versions: [ENV_V1, ENV_V2] },
  ]);
  record({
    email: "free-versions-maxed@nvault.test",
    label: "Free · at file version-history cap",
    scenario:
      "Free account with a file at its 2-version lifetime cap — next upload AND restore must 402; history list is trimmed + flagged `capped`.",
    facts: [
      "Free plan",
      "1 project `web-app`; `.env` has versionsCreated = 2 (FREE_LIMITS.maxVersionsPerFile)",
      "Expected: another upload of `.env` → 402; restore of any version → 402",
    ],
  });

  const freeDevicesMaxed = await makeUser("free-devices-maxed@nvault.test", {
    name: "Free Devices Maxed",
  });
  await addBrowserSession(freeDevicesMaxed.id, "second device", new Date(Date.now() - 60_000));
  record({
    email: "free-devices-maxed@nvault.test",
    label: "Free · at device (browser-session) cap",
    scenario:
      "Free account with 2 active browser sessions — a 3rd sign-in evicts the least-recently-used one (its access token then 401s).",
    facts: [
      "Free plan",
      "2 / 2 active browser sessions (FREE_LIMITS.maxBrowserSessions)",
      "Expected: 3rd login succeeds but revokes the oldest session",
    ],
  });

  // CLI access is now a paid feature, so a Free account cannot hold a CLI
  // token: creating one must 402 and the page shows the paywall card.
  const freeNoCli = await makeUser("free-no-cli@nvault.test", { name: "Free No CLI" });
  await addPersonalProject(freeNoCli, "api-service", [{ filename: ".env", versions: [ENV_V1] }]);
  record({
    email: "free-no-cli@nvault.test",
    label: "Free · CLI access blocked",
    scenario:
      "Free account with no CLI access. Creating a CLI token from Settings → CLI Tokens must 402 with an upgrade prompt; the page shows the paywall card instead of a “New token” button.",
    facts: [
      "Free plan (FREE_LIMITS.maxCliTokens = 0)",
      "0 CLI tokens; POST /api/v1/auth/tokens → 402",
      "GET /api/v1/auth/tokens → { cliAccess: false }",
      "1 personal project (only reachable from the web until the account upgrades)",
    ],
  });

  // Formerly the Free `free-cli` persona — now Pro, since a CLI token requires
  // a paid plan. One active token, room for more (Pro ceiling is 5).
  const proCli = await makeUser("pro-cli@nvault.test", { name: "Pro CLI", keypair: true });
  await grantProSubscription(proCli.id, "ACTIVE");
  await addPersonalProject(proCli, "api-service", [{ filename: ".env", versions: [ENV_V1] }]);
  const proCliToken = await createApiToken(proCli.id, { name: "seed laptop" }, { hasCliAccess: true });
  record({
    email: "pro-cli@nvault.test",
    label: "Pro · CLI token in use",
    scenario:
      "Paid Pro account that has signed a terminal in with a CLI token. The token's value is shown once at creation only; the list shows its prefix + metadata. A 2nd token still creates (Pro allows 5).",
    facts: [
      "Subscription: plan PRO, status ACTIVE",
      "1 / 5 active CLI tokens (PRO_LIMITS.maxCliTokens)",
      "1 personal project the CLI can pull",
    ],
    secrets: {
      "CLI token (evk_…, shown once — real, works against the API)": proCliToken.token,
    },
  });

  // ===== Pro tier ========================================================

  const proActive = await makeUser("pro-active@nvault.test", { name: "Pro Active", keypair: true });
  await grantProSubscription(proActive.id, "ACTIVE");
  for (const name of ["service-a", "service-b", "service-c", "service-d", "service-e"]) {
    await addPersonalProject(
      proActive,
      name,
      [{ filename: ".env", versions: [ENV_V1, ENV_V2, ENV_V3] }],
      { unlimited: true },
    );
  }
  const proToken1 = await createApiToken(proActive.id, { name: "workstation" }, { hasCliAccess: true });
  await createApiToken(proActive.id, { name: "ci-runner" }, { hasCliAccess: true });
  record({
    email: "pro-active@nvault.test",
    label: "Pro · active subscription",
    scenario:
      "Paid Pro account — personal-project cap lifted, 5 devices / 5 CLI tokens, unlimited version history.",
    facts: [
      "Subscription: plan PRO, status ACTIVE",
      "5 personal projects (past the Free cap of 3); each `.env` has 3 versions",
      "2 / 5 active CLI tokens",
    ],
    secrets: { "CLI token (evk_…, shown once)": proToken1.token },
  });

  const proPastDue = await makeUser("pro-past-due@nvault.test", { name: "Pro Past Due" });
  await grantProSubscription(proPastDue.id, "PAST_DUE");
  for (const name of ["p1", "p2", "p3", "p4"]) {
    await addPersonalProject(proPastDue, name, [{ filename: ".env", versions: [ENV_V1] }], {
      unlimited: true,
    });
  }
  record({
    email: "pro-past-due@nvault.test",
    label: "Pro · payment failed (dunning)",
    scenario:
      "Pro subscription in PAST_DUE — Polar is retrying the charge; entitlement is still granted during the dunning window.",
    facts: [
      "Subscription: plan PRO, status PAST_DUE",
      "4 personal projects (still over the Free cap — entitlement holds)",
      "Expected: `userHasActivePro` → true (statusGrantsEntitlement)",
    ],
  });

  const proCanceled = await makeUser("pro-canceled@nvault.test", { name: "Pro Canceled" });
  await grantProSubscription(proCanceled.id, "ACTIVE");
  for (const name of ["legacy-1", "legacy-2", "legacy-3", "legacy-4", "legacy-5"]) {
    await addPersonalProject(proCanceled, name, [{ filename: ".env", versions: [ENV_V1] }], {
      unlimited: true,
    });
  }
  await db.subscription.updateMany({
    where: { ownerUserId: proCanceled.id, plan: "PRO" },
    data: { status: "CANCELED", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(Date.now() - 2 * DAY) },
  });
  record({
    email: "pro-canceled@nvault.test",
    label: "Pro · canceled (over cap, grandfathered)",
    scenario:
      "Pro subscription CANCELED while holding 5 projects — nothing is deleted, but the Free cap is reinstated so no new personal project can be created.",
    facts: [
      "Subscription: plan PRO, status CANCELED",
      "5 personal projects retained (limits are never retroactive)",
      "Expected: POST /projects → 402; existing projects fully usable",
    ],
  });

  const proPending = await makeUser("pro-pending@nvault.test", { name: "Pro Pending" });
  await grantProSubscription(proPending.id, "PENDING");
  for (const name of ["draft-1", "draft-2", "draft-3"]) {
    await addPersonalProject(proPending, name, [{ filename: ".env", versions: [ENV_V1] }]);
  }
  record({
    email: "pro-pending@nvault.test",
    label: "Pro · checkout started, never paid",
    scenario:
      "A PENDING Pro subscription row (checkout opened, payment never completed) — no entitlement; behaves exactly like Free. Also the target of the pending-subscription purge cron.",
    facts: [
      "Subscription: plan PRO, status PENDING",
      "3 / 3 personal projects — still Free-capped",
      "Expected: `userHasActivePro` → false",
    ],
  });

  // ===== Organizations / Team ============================================

  // --- Acme: active STARTER org with a full membership spread ------------
  const acmeOwner = await makeUser("org-owner@nvault.test", { name: "Acme Owner", keypair: true });
  const acme = await makeOrg(acmeOwner, "Acme Corp", "acme-corp", "STARTER");
  await activateOrg(acme.orgId, "STARTER");
  await addOrgProject(acmeOwner, acme, "backend-api", {
    filename: ".env.production",
    contents: ENV_PROD,
  });
  await addOrgProject(acmeOwner, acme, "web-frontend", { filename: ".env", contents: ENV_V1 });
  record({
    email: "org-owner@nvault.test",
    label: "Team · org OWNER (active, STARTER)",
    scenario:
      "Owner + billing manager of an ACTIVE Team org on the STARTER tier (10-member cap). 2 shared org projects.",
    facts: [
      "Org `acme-corp` — status ACTIVE, subscription TEAM/ACTIVE, tier STARTER",
      "Membership: OWNER, status ACTIVE (holds a wrapped Org Key)",
      "Can open the billing portal, change tier, transfer ownership, rotate the Org Key",
    ],
    secrets: {
      "Organization Enrollment Secret (share out-of-band with invitees)": acme.secret,
    },
  });

  const acmeAdmin = await makeUser("org-admin@nvault.test", { name: "Acme Admin", keypair: true });
  await addMember(acme, acmeAdmin, "ADMIN", true);
  record({
    email: "org-admin@nvault.test",
    label: "Team · org ADMIN (enrolled)",
    scenario:
      "ADMIN of Acme — can manage members/invites, create/delete org projects and rotate the Org Key, but cannot touch billing or delete the org.",
    facts: [
      "Membership in `acme-corp`: ADMIN, status ACTIVE",
      "Enrolled via the Enrollment Secret — can decrypt every Acme project",
      "Expected: billing portal / change-tier / delete-org → 403",
    ],
  });

  const acmeMember = await makeUser("org-member@nvault.test", { name: "Acme Member", keypair: true });
  await addMember(acme, acmeMember, "MEMBER", true);
  record({
    email: "org-member@nvault.test",
    label: "Team · org MEMBER (enrolled)",
    scenario: "Regular MEMBER of Acme — read/write files in every org project, no admin powers.",
    facts: [
      "Membership in `acme-corp`: MEMBER, status ACTIVE",
      "Enrolled — shared org projects appear in their project list and decrypt end-to-end",
      "Expected: create invite / create org project → 403",
    ],
  });

  const acmeInvited = await makeUser("org-invited@nvault.test", {
    name: "Acme Invited",
    keypair: true,
  });
  await addMember(acme, acmeInvited, "MEMBER", false);
  record({
    email: "org-invited@nvault.test",
    label: "Team · org member, accepted but NOT enrolled",
    scenario:
      "Accepted the invite (membership row exists) but has not entered the Enrollment Secret yet — holds no Org Key, so Acme's projects are invisible.",
    facts: [
      "Membership in `acme-corp`: MEMBER, status INVITED",
      "`wrappedOrgKeyCiphertext` is null; not in the roster",
      "Expected: org projects hidden from /projects; enroll with the secret flips to ACTIVE",
    ],
  });

  const acmePendingInviteToken = await pendingInvite(acme, "org-pending-invite@nvault.test", "MEMBER");
  await makeUser("org-pending-invite@nvault.test", { name: "Acme Pending Invite", keypair: true });
  record({
    email: "org-pending-invite@nvault.test",
    label: "Team · outstanding (un-accepted) invite",
    scenario:
      "Account exists with a keypair; Acme has sent a MEMBER invite that has not been accepted. Use the token to exercise the accept flow.",
    facts: [
      "No membership row yet — one pending OrganizationInvite for this email on `acme-corp`",
      "Invite expires 7 days after seeding",
      "Expected: POST /invites/accept with a *different* account → 403; correct account → INVITED membership",
    ],
    secrets: {
      "Invite token (oiv_…, single-use)": acmePendingInviteToken,
      "Enrollment Secret for after accepting": acme.secret,
    },
  });

  // --- Beta: org stuck at PENDING_PAYMENT -------------------------------
  const betaOwner = await makeUser("org-owner-pending@nvault.test", {
    name: "Beta Owner",
    keypair: true,
  });
  const beta = await makeOrg(betaOwner, "Beta LLC", "beta-llc", "STARTER");
  record({
    email: "org-owner-pending@nvault.test",
    label: "Team · org OWNER, PENDING_PAYMENT",
    scenario:
      "Created an org but never completed Team checkout — the org is unusable (every org read/write 402s) and shows the checkout CTA. Purged by the cron after 7 days.",
    facts: [
      "Org `beta-llc` — status PENDING_PAYMENT, subscription TEAM/PENDING",
      "Membership: OWNER, status ACTIVE (but org gate blocks everything)",
      "Expected: create project / invite in this org → 402; GET billing → 200 with CTA",
    ],
    secrets: {
      "Organization Enrollment Secret": beta.secret,
    },
  });

  // --- Gamma: previously active, now SUSPENDED --------------------------
  const gammaOwner = await makeUser("org-owner-suspended@nvault.test", {
    name: "Gamma Owner",
    keypair: true,
  });
  const gamma = await makeOrg(gammaOwner, "Gamma Industries", "gamma-industries", "STARTER");
  await activateOrg(gamma.orgId, "STARTER");
  await addOrgProject(gammaOwner, gamma, "monolith", { filename: ".env", contents: ENV_V1 });
  await suspendOrg(gamma.orgId);
  record({
    email: "org-owner-suspended@nvault.test",
    label: "Team · org OWNER, SUSPENDED",
    scenario:
      "Team subscription lapsed (PAST_DUE) → org is read-only: members can still pull existing secrets, but every write 402s until the owner renews.",
    facts: [
      "Org `gamma-industries` — status SUSPENDED, subscription TEAM/PAST_DUE",
      "1 pre-existing org project `monolith` with a file (still readable)",
      "Expected: GET org project files → 200; upload / create project → 402",
    ],
    secrets: { "Organization Enrollment Secret": gamma.secret },
  });

  // --- Delta: active GROWTH tier ---------------------------------------
  const deltaOwner = await makeUser("org-owner-growth@nvault.test", {
    name: "Delta Owner",
    keypair: true,
  });
  const delta = await makeOrg(deltaOwner, "Delta Group", "delta-group", "GROWTH");
  await activateOrg(delta.orgId, "GROWTH");
  await addOrgProject(deltaOwner, delta, "platform", { filename: ".env", contents: ENV_V1 });
  record({
    email: "org-owner-growth@nvault.test",
    label: "Team · org OWNER (active, GROWTH)",
    scenario:
      "ACTIVE Team org on the GROWTH tier (25-member cap) — for exercising tier limits, upgrades and guarded downgrades.",
    facts: [
      "Org `delta-group` — status ACTIVE, subscription TEAM/ACTIVE, tier GROWTH",
      "Membership: OWNER, status ACTIVE",
      "Expected: invites allowed up to 25 seats; downgrade to STARTER refused while > 10 seats",
    ],
    secrets: { "Organization Enrollment Secret": delta.secret },
  });

  // ===== Cross-tenant isolation ==========================================
  await makeUser("outsider@nvault.test", { name: "Outsider", keypair: true });
  record({
    email: "outsider@nvault.test",
    label: "Isolation · unrelated account",
    scenario:
      "A plain account that is not a member of any organization and owns no projects — use it to prove ID-manipulation access to other users' / orgs' resources returns 404, never 403.",
    facts: [
      "Free plan, RSA keypair provisioned, 0 projects, 0 memberships",
      "Expected: GET another user's project / any org by id → 404",
    ],
  });
}

// ---------------------------------------------------------------------------
// Doc generation
// ---------------------------------------------------------------------------

function buildDoc(before: Record<string, number>, after: Record<string, number>): string {
  const now = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push("# Test-scenario accounts");
  lines.push("");
  lines.push(
    "<!-- GENERATED by scripts/seed-test-scenarios.ts — run `pnpm seed:scenarios` to rebuild. -->",
  );
  lines.push("");
  lines.push(`_Last seeded: ${now} against the database in \`DATABASE_URL\`._`);
  lines.push("");
  lines.push(
    "Every account shares one login password and one vault passphrase. Those, plus each " +
      "account's CLI token / organization Enrollment Secret / invite link, are generated per " +
      "seed run and written to **`docs/test-scenarios.local.md`** (git-ignored) — they are also " +
      "printed to the console by `pnpm seed:scenarios`. Set `SEED_ACCOUNT_PASSWORD` / " +
      "`SEED_VAULT_PASSPHRASE` to pin stable values.",
  );
  lines.push("");
  lines.push(
    "> The vault passphrase unlocks the client-side master key. Each account still has its own " +
      "random KDF salt, so the derived keys differ.",
  );
  lines.push("");

  lines.push("## Scenario map");
  lines.push("");
  lines.push("| Email | Scenario | What it exercises |");
  lines.push("|---|---|---|");
  for (const s of scenarios) {
    lines.push(`| \`${s.email}\` | ${s.label} | ${s.scenario.replace(/\n/g, " ")} |`);
  }
  lines.push("");

  lines.push("## Details");
  lines.push("");
  for (const s of scenarios) {
    lines.push(`### \`${s.email}\` — ${s.label}`);
    lines.push("");
    lines.push(s.scenario);
    lines.push("");
    for (const fact of s.facts) lines.push(`- ${fact}`);
    if (s.secrets && Object.keys(s.secrets).length) {
      lines.push(
        `- Secrets (${Object.keys(s.secrets).join(", ")}): see \`docs/test-scenarios.local.md\``,
      );
    }
    lines.push("");
  }

  lines.push("## Database reset");
  lines.push("");
  lines.push("Row counts immediately before the wipe → after re-seeding:");
  lines.push("");
  lines.push("| Table | Before | After |");
  lines.push("|---|--:|--:|");
  for (const model of COUNTABLE) {
    lines.push(`| \`${model}\` | ${before[model] ?? 0} | ${after[model] ?? 0} |`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * The secret half of the report — shared credentials + every per-account
 * token. Written to docs/test-scenarios.local.md, which is git-ignored.
 */
function buildSecretsDoc(): string {
  const lines: string[] = [];
  lines.push("# Test-scenario account secrets");
  lines.push("");
  lines.push("<!-- LOCAL, git-ignored. Regenerated on every `pnpm seed:scenarios` run. -->");
  lines.push("");
  lines.push(`_Generated ${new Date().toISOString()}._`);
  lines.push("");
  lines.push("| | |");
  lines.push("|---|---|");
  lines.push(`| Account password (every account) | \`${ACCOUNT_PASSWORD}\` |`);
  lines.push(`| Vault passphrase (every account) | \`${VAULT_PASSPHRASE}\` |`);
  lines.push("");
  for (const s of scenarios) {
    if (!s.secrets || !Object.keys(s.secrets).length) continue;
    lines.push(`## \`${s.email}\``);
    lines.push("");
    for (const [k, v] of Object.entries(s.secrets)) lines.push(`- **${k}:** \`${v}\``);
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

describe("seed test scenarios", () => {
  it("wipes and re-seeds the target database", async () => {
    const target = new URL(process.env.DATABASE_URL as string);
    console.log(`\n[seed] target: ${target.hostname}${target.pathname}\n`);

    const before = await snapshotCounts();
    console.log("[seed] before:", before);

    await wipeEverything();
    await seed();

    const after = await snapshotCounts();
    console.log("[seed] after:", after);

    const docPath = resolve(process.cwd(), "docs/test-scenarios.md");
    writeFileSync(docPath, buildDoc(before, after), "utf8");
    const secretsPath = resolve(process.cwd(), "docs/test-scenarios.local.md");
    writeFileSync(secretsPath, buildSecretsDoc(), "utf8");

    console.log(`\n[seed] wrote ${docPath}`);
    console.log(`[seed] wrote ${secretsPath} (git-ignored — holds every credential)`);
    console.log(`[seed] account password : ${ACCOUNT_PASSWORD}`);
    console.log(`[seed] vault passphrase : ${VAULT_PASSPHRASE}`);

    console.log(`\n[seed] ${scenarios.length} scenario accounts:`);
    console.table(scenarios.map((s) => ({ email: s.email, scenario: s.label })));

    expect(after.user).toBe(scenarios.length);
    expect(after.organization).toBe(4); // acme, beta, gamma, delta
  }, 600_000);

  afterAll(async () => {
    await db.$disconnect();
  });
});
