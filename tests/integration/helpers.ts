/**
 * Shared harness for the API integration specs (scenarios.spec.ts,
 * leakage.spec.ts). Mirrors the private helpers in api.spec.ts but exported so
 * the leakage/scenario suites don't each re-derive them.
 *
 * Every spec that imports this must also declare its own `jest.mock` for
 * "@/server/billing/polar" (jest.mock is per-file and its factory must be
 * inline so ts-jest can hoist it) — copy the block from api.spec.ts.
 */
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import * as vaultCrypto from "@/lib/crypto";

export { vaultCrypto };

export const db = require("@/server/db").db as import("@/generated/prisma/client").PrismaClient;

export type Handler = (
  req: NextRequest,
  ctx: { params: Record<string, string> },
) => Promise<Response> | Response;

export interface CallOpts {
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
}

export interface CallResult {
  status: number;
  body: any;
  /** Raw response text — used by leak scans (catches non-JSON error bodies). */
  raw: string;
}

export async function call(fn: Handler, opts: CallOpts): Promise<CallResult> {
  const headers: Record<string, string> = { "content-type": "application/json", ...opts.headers };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const req = new NextRequest(`http://localhost${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const res = await fn(req, { params: opts.params ?? {} });
  const raw = await res.text();
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    body = undefined;
  }
  return { status: res.status, body, raw };
}

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

export const routes = {
  register: require("@/app/api/v1/auth/register/route").POST as Handler,
  login: require("@/app/api/v1/auth/login/route").POST as Handler,
  me: require("@/app/api/v1/auth/me/route").GET as Handler,
  sessions: require("@/app/api/v1/auth/sessions/route").GET as Handler,
  revokeSession: require("@/app/api/v1/auth/sessions/[id]/route").DELETE as Handler,
  revokeOtherSessions: require("@/app/api/v1/auth/sessions/revoke-others/route").POST as Handler,
  auditLog: require("@/app/api/v1/audit-log/route").GET as Handler,
  tokens: require("@/app/api/v1/auth/tokens/route") as { GET: Handler; POST: Handler },
  revokeToken: require("@/app/api/v1/auth/tokens/[id]/route").DELETE as Handler,
  keypair: require("@/app/api/v1/auth/vault/keypair/route") as { GET: Handler; POST: Handler },
  projects: require("@/app/api/v1/projects/route") as { GET: Handler; POST: Handler },
  project: require("@/app/api/v1/projects/[id]/route") as {
    GET: Handler;
    PATCH: Handler;
    DELETE: Handler;
  },
  byGitRemote: require("@/app/api/v1/projects/by-git-remote/route").GET as Handler,
  files: require("@/app/api/v1/projects/[id]/files/route") as { GET: Handler; POST: Handler },
  file: require("@/app/api/v1/projects/[id]/files/[fileId]/route") as { DELETE: Handler },
  fileVersions: require("@/app/api/v1/projects/[id]/files/[fileId]/versions/route").GET as Handler,
  fileVersion: require(
    "@/app/api/v1/projects/[id]/files/[fileId]/versions/[versionId]/route",
  ).GET as Handler,
  restore: require("@/app/api/v1/projects/[id]/files/[fileId]/restore/route").POST as Handler,
  filesExport: require("@/app/api/v1/projects/[id]/files/export/route").GET as Handler,
  orgs: require("@/app/api/v1/organizations/route") as { GET: Handler; POST: Handler },
  org: require("@/app/api/v1/organizations/[id]/route") as {
    GET: Handler;
    PATCH: Handler;
    DELETE: Handler;
  },
  orgActivity: require("@/app/api/v1/organizations/[id]/activity/route").GET as Handler,
  orgInvites: require("@/app/api/v1/organizations/[id]/invites/route") as {
    GET?: Handler;
    POST: Handler;
  },
  revokeInvite: require("@/app/api/v1/organizations/[id]/invites/[inviteId]/route").DELETE as Handler,
  acceptInvite: require("@/app/api/v1/invites/accept/route").POST as Handler,
  enroll: require("@/app/api/v1/organizations/[id]/enroll/route").POST as Handler,
  membership: require("@/app/api/v1/organizations/[id]/memberships/[membershipId]/route") as {
    PATCH: Handler;
    DELETE: Handler;
  },
  transferOwnership: require("@/app/api/v1/organizations/[id]/transfer-ownership/route")
    .POST as Handler,
  rotateKey: require("@/app/api/v1/organizations/[id]/rotate-key/route").POST as Handler,
  polarWebhook: require("@/app/api/v1/webhooks/polar/route").POST as Handler,
  orgBilling: require("@/app/api/v1/organizations/[id]/billing/route").GET as Handler,
  changeTier: require("@/app/api/v1/organizations/[id]/billing/change-tier/route").POST as Handler,
  plan: require("@/app/api/v1/billing/plan/route").GET as Handler,
  personalSub: require("@/app/api/v1/billing/subscription/route").GET as Handler,
  proCheckout: require("@/app/api/v1/billing/pro/checkout/route").POST as Handler,
};

// ---------------------------------------------------------------------------
// Account + org factories
// ---------------------------------------------------------------------------

const createdUserIds: string[] = [];

export interface Registered {
  id: string;
  email: string;
  password: string;
  passphrase: string;
  masterKey: Uint8Array;
  token: string;
}
export interface KeypairUser extends Registered {
  publicKey: string;
  privateKey: Uint8Array;
}

export async function registerUser(passphrase = "integration vault passphrase long enough"): Promise<Registered> {
  const email = `it_${randomUUID()}@example.com`;
  const password = "integration test account password 123";
  const provisioned = await vaultCrypto.provisionVault(passphrase);
  const res = await call(routes.register, {
    method: "POST",
    path: "/api/v1/auth/register",
    body: {
      email,
      password,
      kdfSalt: provisioned.keyMaterial.kdfSalt,
      kdfIterations: provisioned.keyMaterial.kdfIterations,
      wrappedMasterKey: provisioned.keyMaterial.wrappedMasterKey,
    },
  });
  if (res.status !== 201) throw new Error(`registerUser failed: ${res.status} ${res.raw}`);
  createdUserIds.push(res.body.user.id);
  return {
    id: res.body.user.id,
    email,
    password,
    passphrase,
    masterKey: provisioned.masterKey,
    token: res.body.accessToken,
  };
}

export async function registerUserWithKeypair(passphrase?: string): Promise<KeypairUser> {
  const user = await registerUser(passphrase);
  const kp = await vaultCrypto.provisionUserKeyPair(user.masterKey);
  const res = await call(routes.keypair.POST, {
    method: "POST",
    path: "/api/v1/auth/vault/keypair",
    token: user.token,
    body: kp.material,
  });
  if (res.status !== 201) throw new Error(`keypair provision failed: ${res.status} ${res.raw}`);
  return { ...user, publicKey: kp.material.publicKey, privateKey: kp.privateKey };
}

export async function loginUser(email: string, password: string): Promise<string> {
  const res = await call(routes.login, {
    method: "POST",
    path: "/api/v1/auth/login",
    body: { email, password },
  });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${res.raw}`);
  return res.body.accessToken as string;
}

export async function mintPat(token: string, name = "cli"): Promise<{ pat: string; id: string }> {
  const res = await call(routes.tokens.POST, {
    method: "POST",
    path: "/api/v1/auth/tokens",
    token,
    body: { name },
  });
  if (res.status !== 201) throw new Error(`mintPat failed: ${res.status} ${res.raw}`);
  return { pat: res.body.token, id: res.body.apiToken.id };
}

/** Personal project keyed under the caller's master key. */
export async function createPersonalProject(
  user: Registered,
  name: string,
  opts: { gitRemoteUrl?: string } = {},
): Promise<{ id: string; projectKey: Uint8Array }> {
  const id = randomUUID();
  const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(user.masterKey, id);
  const res = await call(routes.projects.POST, {
    method: "POST",
    path: "/api/v1/projects",
    token: user.token,
    body: { id, name, wrappedProjectKey, ...(opts.gitRemoteUrl ? { gitRemoteUrl: opts.gitRemoteUrl } : {}) },
  });
  if (res.status !== 201) throw new Error(`createPersonalProject failed: ${res.status} ${res.raw}`);
  return { id, projectKey };
}

export async function uploadFile(
  user: Registered,
  projectId: string,
  projectKey: Uint8Array,
  filename: string,
  plaintext: string,
): Promise<CallResult> {
  const contentId = randomUUID();
  const payload = await vaultCrypto.encryptFileContent(
    projectKey,
    contentId,
    vaultCrypto.utf8ToBytes(plaintext),
  );
  return call(routes.files.POST, {
    method: "POST",
    path: `/api/v1/projects/${projectId}/files`,
    params: { id: projectId },
    token: user.token,
    body: {
      filename,
      payload,
      contentId,
      plaintextSize: plaintext.length,
      plaintextSha256: await vaultCrypto.sha256Hex(vaultCrypto.utf8ToBytes(plaintext)),
    },
  });
}

// ---------------------------------------------------------------------------
// Billing shortcuts (Polar is never reachable in tests)
// ---------------------------------------------------------------------------

export async function grantPro(
  userId: string,
  status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "PENDING" = "ACTIVE",
): Promise<void> {
  const shortId = userId.slice(0, 8);
  await db.subscription.create({
    data: {
      plan: "PRO",
      ownerUserId: userId,
      status,
      polarCustomerId: `cus_it_${shortId}`,
      polarSubscriptionId: `sub_it_pro_${shortId}`,
      polarProductId: process.env.POLAR_PRO_PRODUCT_ID ?? "prod_pro_it",
      currentPeriodEnd: new Date(Date.now() + (status === "CANCELED" ? -2 : 28) * 864e5),
      cancelAtPeriodEnd: status === "CANCELED",
    },
  });
}

const { signWebhookForTest } = require("@/server/billing/polar") as {
  signWebhookForTest: (body: string, opts: { id: string; timestamp: Date }) => Record<string, string>;
};

const TIER_PRODUCT: Record<string, string | undefined> = {
  STARTER: process.env.POLAR_TEAM_STARTER_PRODUCT_ID,
  GROWTH: process.env.POLAR_TEAM_GROWTH_PRODUCT_ID,
  SCALE: process.env.POLAR_TEAM_SCALE_PRODUCT_ID,
};

export async function fireOrgWebhook(
  orgId: string,
  opts: {
    type?: string;
    status?: string;
    eventId?: string;
    tier?: "STARTER" | "GROWTH" | "SCALE";
    currentPeriodEnd?: string;
  } = {},
): Promise<CallResult> {
  const tier = opts.tier ?? "STARTER";
  const body = JSON.stringify({
    type: opts.type ?? "subscription.active",
    data: {
      id: `sub_${orgId}`,
      status: opts.status ?? "active",
      customer_id: `cus_${orgId}`,
      product_id: TIER_PRODUCT[tier],
      cancel_at_period_end: false,
      current_period_end: opts.currentPeriodEnd ?? new Date(Date.now() + 30 * 864e5).toISOString(),
      metadata: { organizationId: orgId, tier },
    },
  });
  const headers = {
    "content-type": "application/json",
    ...signWebhookForTest(body, { id: opts.eventId ?? `evt_${randomUUID()}`, timestamp: new Date() }),
  };
  const req = new NextRequest("http://localhost/api/v1/webhooks/polar", { method: "POST", headers, body });
  const res = await routes.polarWebhook(req, { params: {} });
  const raw = await res.text();
  return { status: res.status, body: raw ? JSON.parse(raw) : undefined, raw };
}

export async function fireProWebhook(
  userId: string,
  opts: { type?: string; status?: string; eventId?: string } = {},
): Promise<CallResult> {
  const body = JSON.stringify({
    type: opts.type ?? "subscription.active",
    data: {
      id: `sub_pro_${userId}`,
      status: opts.status ?? "active",
      customer_id: `cus_${userId}`,
      product_id: process.env.POLAR_PRO_PRODUCT_ID ?? "prod_pro_it",
      cancel_at_period_end: false,
      current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
      metadata: { plan: "PRO", userId },
    },
  });
  const headers = {
    "content-type": "application/json",
    ...signWebhookForTest(body, { id: opts.eventId ?? `evt_${randomUUID()}`, timestamp: new Date() }),
  };
  const req = new NextRequest("http://localhost/api/v1/webhooks/polar", { method: "POST", headers, body });
  const res = await routes.polarWebhook(req, { params: {} });
  const raw = await res.text();
  return { status: res.status, body: raw ? JSON.parse(raw) : undefined, raw };
}

// ---------------------------------------------------------------------------
// Organization build / enroll
// ---------------------------------------------------------------------------

export async function buildOrgBody(
  owner: KeypairUser,
  opts: { name?: string; slug?: string; tier?: string } = {},
) {
  const orgKey = vaultCrypto.generateDataKey();
  const wrappedOrgKey = await vaultCrypto.wrapToPublicKey(owner.publicKey, orgKey);
  const secret = vaultCrypto.generateEnrollmentSecret();
  const enrollment = await vaultCrypto.wrapOrgKeyWithEnrollmentSecret(orgKey, secret);
  const roster = vaultCrypto.withEntry(vaultCrypto.emptyRoster(), owner.id, {
    fingerprint: await vaultCrypto.fingerprintPublicKey(owner.publicKey),
    addedAt: new Date().toISOString(),
  });
  const rosterBlob = await vaultCrypto.encryptRoster(orgKey, roster);
  return {
    orgKey,
    secret,
    body: {
      name: opts.name ?? "Acme",
      slug: opts.slug ?? `acme-${randomUUID().slice(0, 8)}`,
      wrappedOrgKey,
      enrollment,
      roster: rosterBlob,
      pinnedPublicKey: owner.publicKey,
      ...(opts.tier ? { tier: opts.tier } : {}),
    },
  };
}

/** Creates an org and (unless `activate:false`) marks it ACTIVE via the webhook. */
export async function createOrg(
  owner: KeypairUser,
  opts: { tier?: "STARTER" | "GROWTH" | "SCALE"; activate?: boolean; name?: string; slug?: string } = {},
): Promise<{ orgId: string; orgKey: Uint8Array; secret: string }> {
  const { orgKey, secret, body } = await buildOrgBody(owner, {
    tier: opts.tier,
    name: opts.name,
    slug: opts.slug,
  });
  const res = await call(routes.orgs.POST, {
    method: "POST",
    path: "/api/v1/organizations",
    token: owner.token,
    body,
  });
  if (res.status !== 201) throw new Error(`createOrg failed: ${res.status} ${res.raw}`);
  const orgId = res.body.organization.id as string;
  if (opts.activate !== false) {
    const w = await fireOrgWebhook(orgId, { status: "active", tier: opts.tier ?? "STARTER" });
    if (w.status !== 202) throw new Error(`activateOrg failed: ${w.status} ${w.raw}`);
  }
  return { orgId, orgKey, secret };
}

export async function inviteAndEnroll(
  owner: KeypairUser,
  orgId: string,
  secret: string,
  member: KeypairUser,
  role: "ADMIN" | "MEMBER" = "MEMBER",
): Promise<{ membershipId: string }> {
  const inv = await call(routes.orgInvites.POST, {
    method: "POST",
    path: `/api/v1/organizations/${orgId}/invites`,
    params: { id: orgId },
    token: owner.token,
    body: { email: member.email, role },
  });
  if (inv.status !== 201) throw new Error(`invite failed: ${inv.status} ${inv.raw}`);
  const acc = await call(routes.acceptInvite, {
    method: "POST",
    path: "/api/v1/invites/accept",
    token: member.token,
    body: { token: inv.body.token },
  });
  if (acc.status !== 200) throw new Error(`accept failed: ${acc.status} ${acc.raw}`);

  const detail = await call(routes.org.GET, {
    method: "GET",
    path: `/api/v1/organizations/${orgId}`,
    params: { id: orgId },
    token: member.token,
  });
  const orgKey = await vaultCrypto.openOrgKeyWithEnrollmentSecret(secret, detail.body.enrollment);
  const wrappedOrgKey = await vaultCrypto.wrapToPublicKey(member.publicKey, orgKey);
  const roster = await vaultCrypto.decryptRoster(orgKey, detail.body.roster);
  const next = vaultCrypto.withEntry(roster, member.id, {
    fingerprint: await vaultCrypto.fingerprintPublicKey(member.publicKey),
    addedAt: new Date().toISOString(),
  });
  const rosterBlob = await vaultCrypto.encryptRoster(orgKey, next);
  const enrollRes = await call(routes.enroll, {
    method: "POST",
    path: `/api/v1/organizations/${orgId}/enroll`,
    params: { id: orgId },
    token: member.token,
    body: {
      wrappedOrgKey,
      keyEpoch: detail.body.enrollment.keyEpoch,
      pinnedPublicKey: member.publicKey,
      roster: rosterBlob,
      expectedRosterVersion: detail.body.roster.version,
    },
  });
  if (enrollRes.status !== 200) throw new Error(`enroll failed: ${enrollRes.status} ${enrollRes.raw}`);
  return { membershipId: enrollRes.body.membership.id };
}

// ---------------------------------------------------------------------------
// Leak scanning
// ---------------------------------------------------------------------------

export class LeakError extends Error {}

/**
 * Throws if any `needle` in `secrets` appears anywhere in `haystack`. `where`
 * labels the surface (response body, audit row, console line, stored blob).
 */
export function assertNoLeak(where: string, haystack: string, secrets: Array<string | undefined>): void {
  for (const needle of secrets) {
    if (!needle || needle.length < 6) continue;
    if (haystack.includes(needle)) {
      throw new LeakError(
        `LEAK in ${where}: found secret "${truncate(needle)}" (len ${needle.length}) in:\n${truncate(
          haystack,
          800,
        )}`,
      );
    }
  }
}

function truncate(s: string, n = 60): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Common byte encodings a base64/hex secret might be re-encoded into. */
export function encodingsOf(value: string): string[] {
  const out = new Set<string>([value]);
  try {
    out.add(Buffer.from(value, "base64").toString("hex"));
    out.add(Buffer.from(value, "base64").toString("latin1"));
  } catch {
    /* not base64 */
  }
  out.add(Buffer.from(value, "utf8").toString("base64"));
  out.add(Buffer.from(value, "utf8").toString("hex"));
  return [...out].filter((s) => s.length >= 8);
}

/** Captures every console.* line for the duration of a test. */
export function captureConsole(): { lines: string[]; text: () => string; restore: () => void } {
  const lines: string[] = [];
  const fmt = (...a: unknown[]) =>
    lines.push(
      a
        .map((x) => {
          if (typeof x === "string") return x;
          if (x instanceof Error) return `${x.name}: ${x.message}\n${x.stack ?? ""}`;
          try {
            return JSON.stringify(x);
          } catch {
            return String(x);
          }
        })
        .join(" "),
    );
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    jest.spyOn(console, m).mockImplementation(fmt),
  );
  return {
    lines,
    text: () => lines.join("\n"),
    restore: () => spies.forEach((s) => s.mockRestore()),
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function resetRateLimit(): Promise<void> {
  await db.rateLimitHit.deleteMany().catch(() => {});
}

export async function cleanupUsers(): Promise<void> {
  if (createdUserIds.length) {
    await db.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
  }
}

export async function disconnect(): Promise<void> {
  await db.$disconnect();
}

export const describeIf = process.env.DATABASE_URL ? describe : describe.skip;
