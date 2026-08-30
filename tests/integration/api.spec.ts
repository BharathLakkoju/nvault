import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import * as vaultCrypto from "@/lib/crypto";

// The Polar HTTP client is never reachable from tests; stub the two calls
// that would hit the network. Webhook signing/verification stays real.
jest.mock("@/server/billing/polar", () => {
  const actual = jest.requireActual("@/server/billing/polar");
  return {
    __esModule: true,
    ...actual,
    createOrgCheckout: jest.fn(async () => "https://polar.test/checkout/team"),
    createProCheckout: jest.fn(async () => "https://polar.test/checkout/pro"),
    createBillingPortalUrl: jest.fn(async () => "https://polar.test/portal/session"),
    updateSubscriptionProduct: jest.fn(async () => undefined),
  };
});

/**
 * End-to-end coverage of the web -> API -> Postgres path, exercising the real
 * Route Handlers with encryption performed exactly as the browser does it.
 * The assertions verify the server only ever handles ciphertext.
 *
 * Requires DATABASE_URL (see tests/integration/setup.ts). Skipped otherwise.
 */
const describeIf = process.env.DATABASE_URL ? describe : describe.skip;

type Handler = (
  req: NextRequest,
  ctx: { params: Record<string, string> },
) => Promise<Response> | Response;

interface CallOpts {
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
  token?: string;
}

async function call(fn: Handler, opts: CallOpts) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const req = new NextRequest(`http://localhost${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const res = await fn(req, { params: opts.params ?? {} });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

describeIf("nvault API (integration)", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const routes = {
    register: require("@/app/api/v1/auth/register/route").POST as Handler,
    login: require("@/app/api/v1/auth/login/route").POST as Handler,
    me: require("@/app/api/v1/auth/me/route").GET as Handler,
    sessions: require("@/app/api/v1/auth/sessions/route").GET as Handler,
    revokeSession: require("@/app/api/v1/auth/sessions/[id]/route").DELETE as Handler,
    projects: require("@/app/api/v1/projects/route"),
    project: require("@/app/api/v1/projects/[id]/route"),
    files: require("@/app/api/v1/projects/[id]/files/route"),
    fileVersions: require("@/app/api/v1/projects/[id]/files/[fileId]/versions/route")
      .GET as Handler,
    fileVersion: require("@/app/api/v1/projects/[id]/files/[fileId]/versions/[versionId]/route")
      .GET as Handler,
    restore: require("@/app/api/v1/projects/[id]/files/[fileId]/restore/route").POST as Handler,
    tokens: require("@/app/api/v1/auth/tokens/route"),
    revokeToken: require("@/app/api/v1/auth/tokens/[id]/route").DELETE as Handler,
    keypair: require("@/app/api/v1/auth/vault/keypair/route"),
    orgs: require("@/app/api/v1/organizations/route"),
    org: require("@/app/api/v1/organizations/[id]/route"),
    orgInvites: require("@/app/api/v1/organizations/[id]/invites/route"),
    revokeInvite: require("@/app/api/v1/organizations/[id]/invites/[inviteId]/route").DELETE as Handler,
    acceptInvite: require("@/app/api/v1/invites/accept/route").POST as Handler,
    grantKey: require("@/app/api/v1/organizations/[id]/memberships/[membershipId]/grant-key/route")
      .POST as Handler,
    membership: require("@/app/api/v1/organizations/[id]/memberships/[membershipId]/route"),
    transferOwnership: require("@/app/api/v1/organizations/[id]/transfer-ownership/route")
      .POST as Handler,
    rotateKey: require("@/app/api/v1/organizations/[id]/rotate-key/route").POST as Handler,
    polarWebhook: require("@/app/api/v1/webhooks/polar/route").POST as Handler,
    orgBilling: require("@/app/api/v1/organizations/[id]/billing/route").GET as Handler,
    orgCheckout: require("@/app/api/v1/organizations/[id]/billing/checkout/route").POST as Handler,
    changeTier: require("@/app/api/v1/organizations/[id]/billing/change-tier/route").POST as Handler,
    orgPortal: require("@/app/api/v1/organizations/[id]/billing/portal/route").GET as Handler,
    purgeCron: require("@/app/api/v1/internal/purge-pending-orgs/route").GET as Handler,
    plan: require("@/app/api/v1/billing/plan/route").GET as Handler,
    proCheckout: require("@/app/api/v1/billing/pro/checkout/route").POST as Handler,
    personalPortal: require("@/app/api/v1/billing/portal/route").GET as Handler,
    personalSub: require("@/app/api/v1/billing/subscription/route").GET as Handler,
  };

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { signWebhookForTest } = require("@/server/billing/polar") as {
    signWebhookForTest: (
      body: string,
      opts: { id: string; timestamp: Date },
    ) => Record<string, string>;
  };

  const TIER_PRODUCT: Record<string, string> = {
    STARTER: process.env.POLAR_TEAM_STARTER_PRODUCT_ID as string,
    GROWTH: process.env.POLAR_TEAM_GROWTH_PRODUCT_ID as string,
    SCALE: process.env.POLAR_TEAM_SCALE_PRODUCT_ID as string,
  };

  /** Posts a signed Polar `subscription.*` webhook to the real handler. */
  async function fireSubscriptionWebhook(
    orgId: string,
    opts: {
      type?: string;
      status?: string;
      eventId?: string;
      cancelAtPeriodEnd?: boolean;
      currentPeriodEnd?: string;
      subscriptionId?: string;
      tier?: "STARTER" | "GROWTH" | "SCALE";
    } = {},
  ) {
    const eventId = opts.eventId ?? `evt_${randomUUID()}`;
    const tier = opts.tier ?? "SCALE";
    const body = JSON.stringify({
      type: opts.type ?? "subscription.active",
      data: {
        id: opts.subscriptionId ?? `sub_${orgId}`,
        status: opts.status ?? "active",
        customer_id: `cus_${orgId}`,
        product_id: TIER_PRODUCT[tier],
        cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
        current_period_end:
          opts.currentPeriodEnd ?? new Date(Date.now() + 30 * 864e5).toISOString(),
        metadata: { organizationId: orgId, tier },
      },
    });
    const headers = {
      "content-type": "application/json",
      ...signWebhookForTest(body, { id: eventId, timestamp: new Date() }),
    };
    const req = new NextRequest("http://localhost/api/v1/webhooks/polar", {
      method: "POST",
      headers,
      body,
    });
    const res = await routes.polarWebhook(req, { params: {} });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined, eventId };
  }

  /** Marks a freshly-created org ACTIVE by simulating the activation webhook. */
  async function activateOrg(orgId: string) {
    const res = await fireSubscriptionWebhook(orgId, { status: "active" });
    expect(res.status).toBe(202);
    expect(res.body.outcome).toBe("applied");
  }

  /** Posts a signed Polar PRO `subscription.*` webhook (metadata carries userId). */
  async function fireProWebhook(
    userId: string,
    opts: { type?: string; status?: string; eventId?: string; subscriptionId?: string } = {},
  ) {
    const eventId = opts.eventId ?? `evt_${randomUUID()}`;
    const body = JSON.stringify({
      type: opts.type ?? "subscription.active",
      data: {
        id: opts.subscriptionId ?? `sub_pro_${userId}`,
        status: opts.status ?? "active",
        customer_id: `cus_${userId}`,
        product_id: "prod_pro_integration_test",
        cancel_at_period_end: false,
        current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
        metadata: { plan: "PRO", userId },
      },
    });
    const headers = {
      "content-type": "application/json",
      ...signWebhookForTest(body, { id: eventId, timestamp: new Date() }),
    };
    const req = new NextRequest("http://localhost/api/v1/webhooks/polar", {
      method: "POST",
      headers,
      body,
    });
    const res = await routes.polarWebhook(req, { params: {} });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined, eventId };
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FREE_LIMITS_MAX = (require("@/server/billing/entitlements").FREE_LIMITS as {
    maxPersonalProjects: number;
  }).maxPersonalProjects;

  /** Creates a personal project with a throwaway wrapped key; returns {status,body}. */
  async function makePersonalProject(token: string, name: string) {
    const id = randomUUID();
    const { wrappedProjectKey } = await vaultCrypto.createProjectKey(
      vaultCrypto.generateDataKey(),
      id,
    );
    return call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token,
      body: { id, name, wrappedProjectKey },
    });
  }

  const db = require("@/server/db").db as import("@/generated/prisma/client").PrismaClient;
  const createdUserIds: string[] = [];

  // Each test registers several accounts; the shared-IP register/login rate
  // limit (10 / 60s) would otherwise trip partway through the suite.
  beforeEach(async () => {
    await db.rateLimitHit.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    if (createdUserIds.length) {
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await db.$disconnect();
  });

  async function registerUser(vaultPassphrase: string) {
    const email = `it_${randomUUID()}@example.com`;
    const password = "integration test account password 123";
    const provisioned = await vaultCrypto.provisionVault(vaultPassphrase);
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
    expect(res.status).toBe(201);
    createdUserIds.push(res.body.user.id);
    return {
      id: res.body.user.id as string,
      email,
      password,
      masterKey: provisioned.masterKey,
      token: res.body.accessToken as string,
    };
  }

  /** Registers a user and provisions their RSA keypair (required to use orgs). */
  async function registerUserWithKeypair(vaultPassphrase: string) {
    const user = await registerUser(vaultPassphrase);
    const kp = await vaultCrypto.provisionUserKeyPair(user.masterKey);
    const res = await call(routes.keypair.POST, {
      method: "POST",
      path: "/api/v1/auth/vault/keypair",
      token: user.token,
      body: kp.material,
    });
    expect(res.status).toBe(201);
    return { ...user, publicKey: kp.material.publicKey, privateKey: kp.privateKey };
  }

  it("never echoes secrets in the register response", async () => {
    const password = "super secret account password!!";
    const provisioned = await vaultCrypto.provisionVault("super secret vault passphrase!");
    const res = await call(routes.register, {
      method: "POST",
      path: "/api/v1/auth/register",
      body: {
        email: `it_${randomUUID()}@example.com`,
        password,
        kdfSalt: provisioned.keyMaterial.kdfSalt,
        kdfIterations: provisioned.keyMaterial.kdfIterations,
        wrappedMasterKey: provisioned.keyMaterial.wrappedMasterKey,
      },
    });
    createdUserIds.push(res.body.user.id);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain("super secret vault passphrase");
  });

  it("rejects login with the wrong password", async () => {
    const { email } = await registerUser("passphrase-a-long-enough");
    const res = await call(routes.login, {
      method: "POST",
      path: "/api/v1/auth/login",
      body: { email, password: "definitely-wrong-password" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const res = await call(routes.projects.GET, { method: "GET", path: "/api/v1/projects" });
    expect(res.status).toBe(401);
  });

  it("stores only ciphertext, preserves content exactly, versions non-destructively", async () => {
    const { id: userId, masterKey, token } = await registerUser("vault passphrase for lifecycle");
    // This scenario builds v1..v3 of one file — grant Pro so the free-tier
    // 2-versions-per-file cap does not apply. (The cap itself is covered below.)
    await fireProWebhook(userId, { status: "active" });

    const projectId = randomUUID();
    const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(masterKey, projectId);

    const createRes = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token,
      body: { id: projectId, name: `it-project-${Date.now()}`, wrappedProjectKey },
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.project.id).toBe(projectId);

    const original = '# comment\nDATABASE_URL="postgres://u:p@h/db"\nMULTILINE="a\\nb"\n';
    const contentId1 = randomUUID();
    const payload1 = await vaultCrypto.encryptFileContent(
      projectKey,
      contentId1,
      vaultCrypto.utf8ToBytes(original),
    );

    const uploadRes = await call(routes.files.POST, {
      method: "POST",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token,
      body: {
        filename: ".env",
        payload: payload1,
        contentId: contentId1,
        plaintextSize: original.length,
        plaintextSha256: await vaultCrypto.sha256Hex(vaultCrypto.utf8ToBytes(original)),
      },
    });
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.version.versionNumber).toBe(1);

    const listRes = await call(routes.files.GET, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token,
    });
    expect(listRes.body.files).toHaveLength(1);
    expect(JSON.stringify(listRes.body)).not.toContain("DATABASE_URL");

    const fileId = listRes.body.files[0].id as string;
    const versionId = listRes.body.files[0].currentVersion.id as string;

    const downloadRes = await call(routes.fileVersion, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files/${fileId}/versions/${versionId}`,
      params: { id: projectId, fileId, versionId },
      token,
    });
    const decrypted = await vaultCrypto.decryptFileContent(projectKey, contentId1, downloadRes.body.payload);
    expect(vaultCrypto.bytesToUtf8(decrypted)).toBe(original);

    // The stored blob must not be the client ciphertext (server envelope layer).
    const stored = await db.storageObject.findFirst({
      where: { key: { startsWith: `projects/${projectId}/` } },
    });
    expect(stored).toBeTruthy();
    expect(stored!.data[0]).toBe(1); // format version prefix
    expect(Buffer.from(stored!.data).toString("base64")).not.toContain(payload1.ciphertext);

    // second version + restore v1
    const original2 = original.replace("h/db", "otherhost/db2");
    const contentId2 = randomUUID();
    const payload2 = await vaultCrypto.encryptFileContent(
      projectKey,
      contentId2,
      vaultCrypto.utf8ToBytes(original2),
    );
    await call(routes.files.POST, {
      method: "POST",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token,
      body: {
        filename: ".env",
        payload: payload2,
        contentId: contentId2,
        plaintextSize: original2.length,
        plaintextSha256: await vaultCrypto.sha256Hex(vaultCrypto.utf8ToBytes(original2)),
      },
    });

    const versionsRes = await call(routes.fileVersions, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files/${fileId}/versions`,
      params: { id: projectId, fileId },
      token,
    });
    expect(versionsRes.body.versions).toHaveLength(2);
    const v1 = versionsRes.body.versions.find((v: { versionNumber: number }) => v.versionNumber === 1);

    const restoreRes = await call(routes.restore, {
      method: "POST",
      path: `/api/v1/projects/${projectId}/files/${fileId}/restore`,
      params: { id: projectId, fileId },
      token,
      body: { versionId: v1.id },
    });
    expect(restoreRes.status).toBe(201);
    expect(restoreRes.body.version.versionNumber).toBe(3);

    const restored = await call(routes.fileVersion, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files/${fileId}/versions/${restoreRes.body.version.id}`,
      params: { id: projectId, fileId, versionId: restoreRes.body.version.id },
      token,
    });
    const restoredPlain = await vaultCrypto.decryptFileContent(
      projectKey,
      restored.body.payload.contentId,
      restored.body.payload,
    );
    expect(vaultCrypto.bytesToUtf8(restoredPlain)).toBe(original);

    // authorization isolation — another user cannot see this project
    const other = await registerUser("another users vault passphrase");
    const crossRes = await call(routes.project.GET, {
      method: "GET",
      path: `/api/v1/projects/${projectId}`,
      params: { id: projectId },
      token: other.token,
    });
    expect(crossRes.status).toBe(404);

    // path traversal rejected
    const traversal = await call(routes.files.POST, {
      method: "POST",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token,
      body: {
        filename: "../../etc/passwd",
        payload: payload1,
        contentId: randomUUID(),
        plaintextSize: 10,
        plaintextSha256: "0".repeat(64),
      },
    });
    expect(traversal.status).toBe(400);
  });

  it("Free tier caps a file at 2 versions; restore is blocked and history is trimmed", async () => {
    const { masterKey, token } = await registerUser("free tier history passphrase");
    const projectId = randomUUID();
    const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(masterKey, projectId);
    const created = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token,
      body: { id: projectId, name: `hist-${Date.now()}`, wrappedProjectKey },
    });
    expect(created.status).toBe(201);

    async function upload(text: string) {
      const contentId = randomUUID();
      const payload = await vaultCrypto.encryptFileContent(
        projectKey,
        contentId,
        vaultCrypto.utf8ToBytes(text),
      );
      return call(routes.files.POST, {
        method: "POST",
        path: `/api/v1/projects/${projectId}/files`,
        params: { id: projectId },
        token,
        body: {
          filename: ".env",
          payload,
          contentId,
          plaintextSize: text.length,
          plaintextSha256: await vaultCrypto.sha256Hex(vaultCrypto.utf8ToBytes(text)),
        },
      });
    }

    expect((await upload("A=1")).status).toBe(201); // v1
    expect((await upload("A=2")).status).toBe(201); // v2
    const third = await upload("A=3");
    expect(third.status).toBe(402); // free cap reached

    const files = await call(routes.files.GET, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token,
    });
    const fileId = files.body.files[0].id as string;

    const versionsRes = await call(routes.fileVersions, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files/${fileId}/versions`,
      params: { id: projectId, fileId },
      token,
    });
    expect(versionsRes.body.versions).toHaveLength(2);
    expect(versionsRes.body.capped).toBe(true);
    expect(versionsRes.body.limit).toBe(2);

    // Restore also mints a version, so it is refused once the cap is hit.
    const oldest = versionsRes.body.versions.find(
      (v: { isCurrent: boolean }) => !v.isCurrent,
    );
    const restoreRes = await call(routes.restore, {
      method: "POST",
      path: `/api/v1/projects/${projectId}/files/${fileId}/restore`,
      params: { id: projectId, fileId },
      token,
      body: { versionId: oldest.id },
    });
    expect(restoreRes.status).toBe(402);
  });

  it("Free tier keeps only the 2 most-recently-used browser sessions on login", async () => {
    const { email, password } = await registerUser("device cap passphrase");

    async function login() {
      const res = await call(routes.login, {
        method: "POST",
        path: "/api/v1/auth/login",
        body: { email, password },
      });
      expect(res.status).toBe(200);
      return res.body.accessToken as string;
    }

    const t1 = await login();
    const t2 = await login();
    const t3 = await login(); // 3rd sign-in — evicts the least-recently-used

    // t1's access token is now rejected (its session was revoked).
    const stale = await call(routes.projects.GET, {
      method: "GET",
      path: "/api/v1/projects",
      token: t1,
    });
    expect(stale.status).toBe(401);

    // The two newest sessions still work.
    for (const t of [t2, t3]) {
      const ok = await call(routes.projects.GET, {
        method: "GET",
        path: "/api/v1/projects",
        token: t,
      });
      expect(ok.status).toBe(200);
    }

    const sessions = await call(routes.sessions, {
      method: "GET",
      path: "/api/v1/auth/sessions",
      token: t3,
    });
    const live = sessions.body.sessions.filter((s: { revokedAt: string | null }) => !s.revokedAt);
    expect(live).toHaveLength(2);
  });

  it("issues a CLI access token that authenticates the API and stops working once revoked", async () => {
    const { token } = await registerUser("cli token vault passphrase");

    const createRes = await call(routes.tokens.POST, {
      method: "POST",
      path: "/api/v1/auth/tokens",
      token,
      body: { name: "integration laptop" },
    });
    expect(createRes.status).toBe(201);
    const pat = createRes.body.token as string;
    expect(pat).toMatch(/^evk_/);
    expect(createRes.body.apiToken.id).toBeTruthy();

    // Free accounts get a single CLI token — a second is refused (409) until
    // one is revoked.
    const secondToken = await call(routes.tokens.POST, {
      method: "POST",
      path: "/api/v1/auth/tokens",
      token,
      body: { name: "second device" },
    });
    expect(secondToken.status).toBe(409);

    // The raw token is only ever in the create response — never in list.
    const listRes = await call(routes.tokens.GET, {
      method: "GET",
      path: "/api/v1/auth/tokens",
      token,
    });
    expect(JSON.stringify(listRes.body)).not.toContain(pat);
    expect(listRes.body.tokens[0].name).toBe("integration laptop");

    // CLI-token sessions are hidden from the browser Sessions list.
    const sessionsRes = await call(routes.sessions, {
      method: "GET",
      path: "/api/v1/auth/sessions",
      token: pat,
    });
    expect(sessionsRes.body.sessions.some((s: { id: string }) => s.id === createRes.body.apiToken.id)).toBe(
      false,
    );

    // The PAT authenticates a normal request.
    const asPat = await call(routes.projects.GET, {
      method: "GET",
      path: "/api/v1/projects",
      token: pat,
    });
    expect(asPat.status).toBe(200);

    const revokeRes = await call(routes.revokeToken, {
      method: "DELETE",
      path: `/api/v1/auth/tokens/${createRes.body.apiToken.id}`,
      params: { id: createRes.body.apiToken.id },
      token,
    });
    expect(revokeRes.status).toBe(204);

    const afterRevoke = await call(routes.projects.GET, {
      method: "GET",
      path: "/api/v1/projects",
      token: pat,
    });
    expect(afterRevoke.status).toBe(401);

    // With the first token revoked, the free slot frees up.
    const replacement = await call(routes.tokens.POST, {
      method: "POST",
      path: "/api/v1/auth/tokens",
      token,
      body: { name: "replacement" },
    });
    expect(replacement.status).toBe(201);
  });

  it("provisions a user keypair once, stores only ciphertext, and refuses to replace it", async () => {
    const { masterKey, token } = await registerUser("keypair vault passphrase");

    // Fresh accounts have no keypair.
    const before = await call(routes.keypair.GET, {
      method: "GET",
      path: "/api/v1/auth/vault/keypair",
      token,
    });
    expect(before.status).toBe(200);
    expect(before.body.keyPairMaterial).toBeNull();

    const provisioned = await vaultCrypto.provisionUserKeyPair(masterKey);
    const create = await call(routes.keypair.POST, {
      method: "POST",
      path: "/api/v1/auth/vault/keypair",
      token,
      body: provisioned.material,
    });
    expect(create.status).toBe(201);
    expect(create.body.keyPairMaterial.publicKey).toBe(provisioned.material.publicKey);

    // The server never returns the raw private key bytes.
    const serialized = JSON.stringify(create.body);
    expect(serialized).not.toContain(vaultCrypto.bytesToBase64(provisioned.privateKey));

    // me() now reports the keypair.
    const meRes = await call(routes.me, { method: "GET", path: "/api/v1/auth/me", token });
    expect(meRes.body.keyPairMaterial.publicKey).toBe(provisioned.material.publicKey);

    // Write-once: a second provision is rejected and changes nothing.
    const second = await vaultCrypto.provisionUserKeyPair(masterKey);
    const replace = await call(routes.keypair.POST, {
      method: "POST",
      path: "/api/v1/auth/vault/keypair",
      token,
      body: second.material,
    });
    expect(replace.status).toBe(409);
    const after = await call(routes.keypair.GET, {
      method: "GET",
      path: "/api/v1/auth/vault/keypair",
      token,
    });
    expect(after.body.keyPairMaterial.publicKey).toBe(provisioned.material.publicKey);

    // The stored wrapped private key round-trips back to the original.
    const recovered = await vaultCrypto.unwrapUserPrivateKey(
      masterKey,
      after.body.keyPairMaterial,
    );
    expect(vaultCrypto.bytesToBase64(recovered)).toBe(
      vaultCrypto.bytesToBase64(provisioned.privateKey),
    );
  });

  it("creates an org with the caller as active OWNER, and shares a project zero-knowledge", async () => {
    const alice = await registerUserWithKeypair("alice org passphrase");

    // Alice generates an Org Key in-memory, wrapped to her own public key.
    const orgKey = vaultCrypto.generateDataKey();
    const wrappedForAlice = await vaultCrypto.wrapToPublicKey(alice.publicKey, orgKey);

    const createRes = await call(routes.orgs.POST, {
      method: "POST",
      path: "/api/v1/organizations",
      token: alice.token,
      body: { name: "Acme", slug: `acme-${Date.now()}`, wrappedOrgKey: wrappedForAlice },
    });
    expect(createRes.status).toBe(201);
    const orgId = createRes.body.organization.id as string;
    expect(createRes.body.organization.currentKeyEpoch).toBe(0);

    // The org is unusable until the Team subscription is paid.
    await activateOrg(orgId);

    // No response from the org endpoints contains the raw Org Key bytes.
    const detailRes = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: alice.token,
    });
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.self.role).toBe("OWNER");
    expect(detailRes.body.self.status).toBe("ACTIVE");
    expect(JSON.stringify(detailRes.body)).not.toContain(vaultCrypto.bytesToBase64(orgKey));

    // Alice unwraps her Org Key and creates an org project keyed under it.
    const recoveredOrgKey = await vaultCrypto.unwrapFromPrivateKey(
      alice.privateKey,
      detailRes.body.self.wrappedOrgKey,
    );
    expect(vaultCrypto.bytesToBase64(recoveredOrgKey)).toBe(vaultCrypto.bytesToBase64(orgKey));

    const projectId = randomUUID();
    const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(
      recoveredOrgKey,
      projectId,
    );
    const projRes = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: alice.token,
      body: { id: projectId, name: `org-proj-${Date.now()}`, wrappedProjectKey, organizationId: orgId },
    });
    expect(projRes.status).toBe(201);
    expect(projRes.body.project.scope).toBe("org");

    // Upload a file to the org project.
    const secret = "SHARED_API_KEY=team-secret\n";
    const contentId = randomUUID();
    const payload = await vaultCrypto.encryptFileContent(
      projectKey,
      contentId,
      vaultCrypto.utf8ToBytes(secret),
    );
    const upRes = await call(routes.files.POST, {
      method: "POST",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token: alice.token,
      body: {
        filename: ".env",
        payload,
        contentId,
        plaintextSize: secret.length,
        plaintextSha256: await vaultCrypto.sha256Hex(vaultCrypto.utf8ToBytes(secret)),
      },
    });
    expect(upRes.status).toBe(201);

    // A non-member cannot see or touch the org project — 404, never 403.
    const mallory = await registerUserWithKeypair("mallory passphrase");
    for (const [handler, path] of [
      [routes.project.GET, `/api/v1/projects/${projectId}`],
      [routes.files.GET, `/api/v1/projects/${projectId}/files`],
      [routes.org.GET, `/api/v1/organizations/${orgId}`],
    ] as const) {
      const res = await call(handler, {
        method: "GET",
        path,
        params: { id: path.includes("organizations") ? orgId : projectId },
        token: mallory.token,
      });
      expect(res.status).toBe(404);
    }

    // The org project shows up in Alice's project list, scoped to the org.
    const listRes = await call(routes.projects.GET, {
      method: "GET",
      path: "/api/v1/projects",
      token: alice.token,
    });
    const listed = listRes.body.projects.find((p: { id: string }) => p.id === projectId);
    expect(listed.organizationId).toBe(orgId);
    expect(JSON.stringify(listRes.body)).not.toContain("SHARED_API_KEY");
  });

  it("blocks project creation in an org the caller is not an admin of", async () => {
    const owner = await registerUserWithKeypair("owner passphrase");
    const orgKey = vaultCrypto.generateDataKey();
    const wrapped = await vaultCrypto.wrapToPublicKey(owner.publicKey, orgKey);
    const createRes = await call(routes.orgs.POST, {
      method: "POST",
      path: "/api/v1/organizations",
      token: owner.token,
      body: { name: "Beta", slug: `beta-${Date.now()}`, wrappedOrgKey: wrapped },
    });
    const orgId = createRes.body.organization.id as string;

    // A stranger cannot create a project in the org (404 — existence hidden).
    const stranger = await registerUserWithKeypair("stranger passphrase");
    const projectId = randomUUID();
    const { wrappedProjectKey } = await vaultCrypto.createProjectKey(orgKey, projectId);
    const res = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: stranger.token,
      body: { id: projectId, name: "nope", wrappedProjectKey, organizationId: orgId },
    });
    expect(res.status).toBe(404);
  });

  async function createOrg(owner: Awaited<ReturnType<typeof registerUserWithKeypair>>) {
    const orgKey = vaultCrypto.generateDataKey();
    const wrapped = await vaultCrypto.wrapToPublicKey(owner.publicKey, orgKey);
    const res = await call(routes.orgs.POST, {
      method: "POST",
      path: "/api/v1/organizations",
      token: owner.token,
      body: { name: "Team", slug: `team-${randomUUID().slice(0, 8)}`, wrappedOrgKey: wrapped },
    });
    expect(res.status).toBe(201);
    expect(res.body.organization.orgStatus).toBe("PENDING_PAYMENT");
    expect(res.body.checkout.url).toContain("polar.test");
    const orgId = res.body.organization.id as string;
    await activateOrg(orgId);
    return { orgId, orgKey };
  }

  it("runs the full invite → accept → grant-key → shared-decrypt flow", async () => {
    const alice = await registerUserWithKeypair("alice invite flow");
    const bob = await registerUserWithKeypair("bob invite flow");
    const { orgId, orgKey } = await createOrg(alice);

    // Alice invites Bob as MEMBER.
    const inviteRes = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: alice.token,
      body: { email: bob.email, role: "MEMBER" },
    });
    expect(inviteRes.status).toBe(201);
    const inviteToken = inviteRes.body.token as string;
    expect(inviteToken).toMatch(/^oiv_/);

    // A different account cannot redeem the link.
    const mallory = await registerUserWithKeypair("mallory invite");
    const wrongAccount = await call(routes.acceptInvite, {
      method: "POST",
      path: "/api/v1/invites/accept",
      token: mallory.token,
      body: { token: inviteToken },
    });
    expect(wrongAccount.status).toBe(403);

    // Bob accepts — becomes an INVITED member with no key yet.
    const acceptRes = await call(routes.acceptInvite, {
      method: "POST",
      path: "/api/v1/invites/accept",
      token: bob.token,
      body: { token: inviteToken },
    });
    expect(acceptRes.status).toBe(200);

    // The token is single-use.
    const reuse = await call(routes.acceptInvite, {
      method: "POST",
      path: "/api/v1/invites/accept",
      token: bob.token,
      body: { token: inviteToken },
    });
    expect(reuse.status).toBe(404);

    // Alice creates an org project + uploads a secret.
    const projectId = randomUUID();
    const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(orgKey, projectId);
    await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: alice.token,
      body: { id: projectId, name: `proj-${Date.now()}`, wrappedProjectKey, organizationId: orgId },
    });
    const secret = "TEAM_TOKEN=shhh\n";
    const contentId = randomUUID();
    const payload = await vaultCrypto.encryptFileContent(
      projectKey,
      contentId,
      vaultCrypto.utf8ToBytes(secret),
    );
    await call(routes.files.POST, {
      method: "POST",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token: alice.token,
      body: {
        filename: ".env",
        payload,
        contentId,
        plaintextSize: secret.length,
        plaintextSha256: await vaultCrypto.sha256Hex(vaultCrypto.utf8ToBytes(secret)),
      },
    });

    // Bob has no key yet → the org project is invisible to him.
    let bobProjects = await call(routes.projects.GET, {
      method: "GET",
      path: "/api/v1/projects",
      token: bob.token,
    });
    expect(bobProjects.body.projects.some((p: { id: string }) => p.id === projectId)).toBe(false);

    // Alice grants Bob the Org Key (wrapped to Bob's public key).
    const detail = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: alice.token,
    });
    const bobMembership = detail.body.members.find(
      (m: { email: string }) => m.email === bob.email,
    );
    const wrappedForBob = await vaultCrypto.wrapToPublicKey(bobMembership.publicKey, orgKey);
    const grantRes = await call(routes.grantKey, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/memberships/${bobMembership.id}/grant-key`,
      params: { id: orgId, membershipId: bobMembership.id },
      token: alice.token,
      body: { wrappedOrgKey: wrappedForBob, keyEpoch: 0 },
    });
    expect(grantRes.status).toBe(200);

    // Now Bob sees the project and can decrypt the file end-to-end with only
    // his own keypair + the granted Org Key blob.
    const bobDetail = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: bob.token,
    });
    const bobOrgKey = await vaultCrypto.unwrapFromPrivateKey(
      bob.privateKey,
      bobDetail.body.self.wrappedOrgKey,
    );
    expect(vaultCrypto.bytesToBase64(bobOrgKey)).toBe(vaultCrypto.bytesToBase64(orgKey));

    bobProjects = await call(routes.projects.GET, {
      method: "GET",
      path: "/api/v1/projects",
      token: bob.token,
    });
    const bobProject = bobProjects.body.projects.find((p: { id: string }) => p.id === projectId);
    expect(bobProject).toBeTruthy();

    const bobFiles = await call(routes.files.GET, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token: bob.token,
    });
    const fileId = bobFiles.body.files[0].id as string;
    const versionId = bobFiles.body.files[0].currentVersion.id as string;
    const download = await call(routes.fileVersion, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files/${fileId}/versions/${versionId}`,
      params: { id: projectId, fileId, versionId },
      token: bob.token,
    });
    const bobProjectKey = await vaultCrypto.openProjectKey(
      bobOrgKey,
      projectId,
      bobProject.wrappedProjectKey,
    );
    const decrypted = await vaultCrypto.decryptFileContent(
      bobProjectKey,
      download.body.payload.contentId,
      download.body.payload,
    );
    expect(vaultCrypto.bytesToUtf8(decrypted)).toBe(secret);

    // No org endpoint response ever contains the raw Org Key.
    expect(JSON.stringify(bobDetail.body)).not.toContain(vaultCrypto.bytesToBase64(orgKey));
  });

  it("enforces role rules: members can't invite, last owner is protected, removal cuts access", async () => {
    const owner = await registerUserWithKeypair("owner rules");
    const member = await registerUserWithKeypair("member rules");
    const { orgId, orgKey } = await createOrg(owner);

    // Add member (invite + accept + grant).
    const inv = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: owner.token,
      body: { email: member.email, role: "MEMBER" },
    });
    await call(routes.acceptInvite, {
      method: "POST",
      path: "/api/v1/invites/accept",
      token: member.token,
      body: { token: inv.body.token },
    });
    const detail = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: owner.token,
    });
    const memberRow = detail.body.members.find((m: { email: string }) => m.email === member.email);
    const wrappedForMember = await vaultCrypto.wrapToPublicKey(memberRow.publicKey, orgKey);
    await call(routes.grantKey, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/memberships/${memberRow.id}/grant-key`,
      params: { id: orgId, membershipId: memberRow.id },
      token: owner.token,
      body: { wrappedOrgKey: wrappedForMember, keyEpoch: 0 },
    });

    // A MEMBER cannot invite.
    const memberInvite = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: member.token,
      body: { email: "someone@example.com", role: "MEMBER" },
    });
    expect(memberInvite.status).toBe(403);

    // The sole owner cannot be removed / cannot leave.
    const ownerRow = detail.body.members.find((m: { role: string }) => m.role === "OWNER");
    const removeOwner = await call(routes.membership.DELETE, {
      method: "DELETE",
      path: `/api/v1/organizations/${orgId}/memberships/${ownerRow.id}`,
      params: { id: orgId, membershipId: ownerRow.id },
      token: owner.token,
    });
    expect(removeOwner.status).toBe(409);

    // Owner removes the member — response asks for a key rotation.
    const removeMember = await call(routes.membership.DELETE, {
      method: "DELETE",
      path: `/api/v1/organizations/${orgId}/memberships/${memberRow.id}`,
      params: { id: orgId, membershipId: memberRow.id },
      token: owner.token,
    });
    expect(removeMember.status).toBe(200);
    expect(removeMember.body.rotationRequired).toBe(true);

    // The removed member immediately loses API access to the org.
    const afterRemoval = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: member.token,
    });
    expect(afterRemoval.status).toBe(404);
  });

  it("rotates the org key: rejects partial coverage, then re-keys projects and members", async () => {
    const owner = await registerUserWithKeypair("rotate owner");
    const member = await registerUserWithKeypair("rotate member");
    const { orgId, orgKey } = await createOrg(owner);

    // Bring `member` on board with key access.
    const inv = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: owner.token,
      body: { email: member.email, role: "MEMBER" },
    });
    await call(routes.acceptInvite, {
      method: "POST",
      path: "/api/v1/invites/accept",
      token: member.token,
      body: { token: inv.body.token },
    });
    let detail = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: owner.token,
    });
    const ownerMembership = detail.body.members.find((m: { role: string }) => m.role === "OWNER");
    const memberRow = detail.body.members.find((m: { email: string }) => m.email === member.email);
    await call(routes.grantKey, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/memberships/${memberRow.id}/grant-key`,
      params: { id: orgId, membershipId: memberRow.id },
      token: owner.token,
      body: { wrappedOrgKey: await vaultCrypto.wrapToPublicKey(memberRow.publicKey, orgKey), keyEpoch: 0 },
    });

    // One org project with a file.
    const projectId = randomUUID();
    const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(orgKey, projectId);
    await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: owner.token,
      body: { id: projectId, name: `rot-${Date.now()}`, wrappedProjectKey, organizationId: orgId },
    });
    const secret = "ROTATED=yes\n";
    const contentId = randomUUID();
    await call(routes.files.POST, {
      method: "POST",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token: owner.token,
      body: {
        filename: ".env",
        payload: await vaultCrypto.encryptFileContent(projectKey, contentId, vaultCrypto.utf8ToBytes(secret)),
        contentId,
        plaintextSize: secret.length,
        plaintextSha256: await vaultCrypto.sha256Hex(vaultCrypto.utf8ToBytes(secret)),
      },
    });

    // New Org Key, re-wrap everything.
    const newOrgKey = vaultCrypto.generateDataKey();
    const newWrappedProjectKey = await vaultCrypto.wrapProjectKey(newOrgKey, projectId, projectKey);
    const memberKeysFull = [
      { membershipId: ownerMembership.id, wrappedOrgKey: await vaultCrypto.wrapToPublicKey(owner.publicKey, newOrgKey) },
      { membershipId: memberRow.id, wrappedOrgKey: await vaultCrypto.wrapToPublicKey(member.publicKey, newOrgKey) },
    ];

    // Missing a member → 400.
    const partial = await call(routes.rotateKey, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/rotate-key`,
      params: { id: orgId },
      token: owner.token,
      body: {
        newEpoch: 1,
        projectKeys: [{ projectId, wrappedProjectKey: newWrappedProjectKey }],
        memberKeys: [memberKeysFull[0]],
      },
    });
    expect(partial.status).toBe(400);

    // Wrong epoch → 409.
    const wrongEpoch = await call(routes.rotateKey, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/rotate-key`,
      params: { id: orgId },
      token: owner.token,
      body: {
        newEpoch: 5,
        projectKeys: [{ projectId, wrappedProjectKey: newWrappedProjectKey }],
        memberKeys: memberKeysFull,
      },
    });
    expect(wrongEpoch.status).toBe(409);

    // Full, correct rotation.
    const ok = await call(routes.rotateKey, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/rotate-key`,
      params: { id: orgId },
      token: owner.token,
      body: {
        newEpoch: 1,
        projectKeys: [{ projectId, wrappedProjectKey: newWrappedProjectKey }],
        memberKeys: memberKeysFull,
      },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.epoch).toBe(1);

    // The member, using only the NEW wrapped Org Key, still decrypts the file.
    detail = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: member.token,
    });
    expect(detail.body.organization.currentKeyEpoch).toBe(1);
    const memberNewOrgKey = await vaultCrypto.unwrapFromPrivateKey(
      member.privateKey,
      detail.body.self.wrappedOrgKey,
    );
    expect(vaultCrypto.bytesToBase64(memberNewOrgKey)).toBe(vaultCrypto.bytesToBase64(newOrgKey));

    const list = await call(routes.projects.GET, {
      method: "GET",
      path: "/api/v1/projects",
      token: member.token,
    });
    const proj = list.body.projects.find((p: { id: string }) => p.id === projectId);
    expect(proj.keyEpoch).toBe(1);
    const memberProjectKey = await vaultCrypto.openProjectKey(memberNewOrgKey, projectId, proj.wrappedProjectKey);
    const files = await call(routes.files.GET, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token: member.token,
    });
    const dl = await call(routes.fileVersion, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files/${files.body.files[0].id}/versions/${files.body.files[0].currentVersion.id}`,
      params: { id: projectId, fileId: files.body.files[0].id, versionId: files.body.files[0].currentVersion.id },
      token: member.token,
    });
    const plain = await vaultCrypto.decryptFileContent(memberProjectKey, dl.body.payload.contentId, dl.body.payload);
    expect(vaultCrypto.bytesToUtf8(plain)).toBe(secret);

    // The pre-rotation Org Key no longer opens the (re-wrapped) project key.
    await expect(
      vaultCrypto.openProjectKey(orgKey, projectId, proj.wrappedProjectKey),
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Billing / paywall
  // -------------------------------------------------------------------------

  async function createRawOrg(owner: Awaited<ReturnType<typeof registerUserWithKeypair>>) {
    const orgKey = vaultCrypto.generateDataKey();
    const wrapped = await vaultCrypto.wrapToPublicKey(owner.publicKey, orgKey);
    const res = await call(routes.orgs.POST, {
      method: "POST",
      path: "/api/v1/organizations",
      token: owner.token,
      body: { name: "Team", slug: `team-${randomUUID().slice(0, 8)}`, wrappedOrgKey: wrapped },
    });
    expect(res.status).toBe(201);
    return { orgId: res.body.organization.id as string, orgKey, body: res.body };
  }

  it("a new org is PENDING_PAYMENT: gets a checkout URL, and its writes are 402 until paid", async () => {
    const alice = await registerUserWithKeypair("billing pending passphrase");
    const { orgId, orgKey, body } = await createRawOrg(alice);
    expect(body.organization.orgStatus).toBe("PENDING_PAYMENT");
    expect(body.checkout.url).toContain("polar.test");

    // Creating a project in the pending org is refused with 402.
    const projectId = randomUUID();
    const { wrappedProjectKey } = await vaultCrypto.createProjectKey(orgKey, projectId);
    const projRes = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: alice.token,
      body: { id: projectId, name: "p1", wrappedProjectKey, organizationId: orgId },
    });
    expect(projRes.status).toBe(402);

    // Inviting is refused too.
    const bob = await registerUserWithKeypair("bob pending");
    const inviteRes = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: alice.token,
      body: { email: bob.email, role: "MEMBER" },
    });
    expect(inviteRes.status).toBe(402);

    // The pending org's (nonexistent) projects never surface in the list.
    const listRes = await call(routes.projects.GET, {
      method: "GET",
      path: "/api/v1/projects",
      token: alice.token,
    });
    expect(
      listRes.body.projects.some((p: { organizationId: string | null }) => p.organizationId === orgId),
    ).toBe(false);

    // Billing status is readable even while pending (owner needs the CTA).
    const billingRes = await call(routes.orgBilling, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}/billing`,
      params: { id: orgId },
      token: alice.token,
    });
    expect(billingRes.status).toBe(200);
    expect(billingRes.body.orgStatus).toBe("PENDING_PAYMENT");
  });

  it("subscription.active activates the org; past_due suspends it (reads ok, writes 402)", async () => {
    const alice = await registerUserWithKeypair("billing lifecycle passphrase");
    const { orgId, orgKey } = await createRawOrg(alice);

    await activateOrg(orgId);

    // Now project creation works.
    const projectId = randomUUID();
    const { wrappedProjectKey } = await vaultCrypto.createProjectKey(orgKey, projectId);
    const projRes = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: alice.token,
      body: { id: projectId, name: "active-proj", wrappedProjectKey, organizationId: orgId },
    });
    expect(projRes.status).toBe(201);

    // Payment lapses.
    const pastDue = await fireSubscriptionWebhook(orgId, {
      type: "subscription.past_due",
      status: "past_due",
    });
    expect(pastDue.status).toBe(202);

    // Reads still work…
    const readRes = await call(routes.files.GET, {
      method: "GET",
      path: `/api/v1/projects/${projectId}/files`,
      params: { id: projectId },
      token: alice.token,
    });
    expect(readRes.status).toBe(200);

    // …writes do not.
    const newProjectId = randomUUID();
    const second = await vaultCrypto.createProjectKey(orgKey, newProjectId);
    const blockedRes = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: alice.token,
      body: {
        id: newProjectId,
        name: "blocked-proj",
        wrappedProjectKey: second.wrappedProjectKey,
        organizationId: orgId,
      },
    });
    expect(blockedRes.status).toBe(402);

    // Recovery: a fresh active event restores write access.
    await activateOrg(orgId);
    const recoveredRes = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: alice.token,
      body: {
        id: newProjectId,
        name: "recovered-proj",
        wrappedProjectKey: second.wrappedProjectKey,
        organizationId: orgId,
      },
    });
    expect(recoveredRes.status).toBe(201);
  });

  it("replays a webhook idempotently and rejects a bad signature", async () => {
    const alice = await registerUserWithKeypair("billing webhook passphrase");
    const { orgId } = await createRawOrg(alice);

    const eventId = `evt_replay_${randomUUID()}`;
    const first = await fireSubscriptionWebhook(orgId, { eventId });
    expect(first.body.outcome).toBe("applied");
    const replay = await fireSubscriptionWebhook(orgId, { eventId });
    expect(replay.body.outcome).toBe("duplicate");

    // Tampered body → signature mismatch → 400, no state change.
    const body = JSON.stringify({
      type: "subscription.revoked",
      data: { id: `sub_${orgId}`, status: "canceled", metadata: { organizationId: orgId } },
    });
    const goodHeaders = signWebhookForTest(body, { id: "evt_bad", timestamp: new Date() });
    const tampered = new NextRequest("http://localhost/api/v1/webhooks/polar", {
      method: "POST",
      headers: { "content-type": "application/json", ...goodHeaders },
      body: body.replace("canceled", "active"),
    });
    const res = await routes.polarWebhook(tampered, { params: {} });
    expect(res.status).toBe(400);

    const org = await db.organization.findUnique({ where: { id: orgId } });
    expect(org?.status).toBe("ACTIVE"); // unchanged by the rejected event
  });

  it("caps personal projects on the free plan", async () => {
    const user = await registerUser("free tier cap passphrase");

    const planRes = await call(routes.plan, {
      method: "GET",
      path: "/api/v1/billing/plan",
      token: user.token,
    });
    const cap = planRes.body.freeMaxPersonalProjects as number;

    for (let i = 0; i < cap; i++) {
      const id = randomUUID();
      const { wrappedProjectKey } = await vaultCrypto.createProjectKey(
        vaultCrypto.generateDataKey(),
        id,
      );
      // Wrap under the master key path isn't exercised here; the server only
      // stores the ciphertext, so any well-formed wrapped key is accepted.
      const res = await call(routes.projects.POST, {
        method: "POST",
        path: "/api/v1/projects",
        token: user.token,
        body: { id, name: `free-${i}`, wrappedProjectKey },
      });
      expect(res.status).toBe(201);
    }

    const overflowId = randomUUID();
    const { wrappedProjectKey } = await vaultCrypto.createProjectKey(
      vaultCrypto.generateDataKey(),
      overflowId,
    );
    const overflow = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: user.token,
      body: { id: overflowId, name: "free-overflow", wrappedProjectKey },
    });
    expect(overflow.status).toBe(402);
  });

  it("Pro subscription lifts the personal-project cap; canceling reinstates it", async () => {
    const user = await registerUser("pro tier passphrase");

    // Fill the free tier.
    const cap = FREE_LIMITS_MAX;
    for (let i = 0; i < cap; i++) {
      const id = randomUUID();
      const { wrappedProjectKey } = await vaultCrypto.createProjectKey(
        vaultCrypto.generateDataKey(),
        id,
      );
      const res = await call(routes.projects.POST, {
        method: "POST",
        path: "/api/v1/projects",
        token: user.token,
        body: { id, name: `p${i}`, wrappedProjectKey },
      });
      expect(res.status).toBe(201);
    }

    // Start Pro checkout -> URL + a PENDING subscription row (no entitlement yet).
    const checkoutRes = await call(routes.proCheckout, {
      method: "POST",
      path: "/api/v1/billing/pro/checkout",
      token: user.token,
    });
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.url).toContain("polar.test");

    const stillCapped = await makePersonalProject(user.token, "over-1");
    expect(stillCapped.status).toBe(402);

    // Activation webhook -> unlimited.
    const activate = await fireProWebhook(user.id, { status: "active" });
    expect(activate.status).toBe(202);
    expect(activate.body.outcome).toBe("applied");

    for (const name of ["over-1", "over-2", "over-3"]) {
      const r = await makePersonalProject(user.token, name);
      expect(r.status).toBe(201);
    }

    const subRes = await call(routes.personalSub, {
      method: "GET",
      path: "/api/v1/billing/subscription",
      token: user.token,
    });
    expect(subRes.body.pro.status).toBe("ACTIVE");

    // Cancel -> cap reinstated, but existing projects are untouched.
    const revoke = await fireProWebhook(user.id, {
      type: "subscription.revoked",
      status: "canceled",
    });
    expect(revoke.status).toBe(202);

    const cappedAgain = await makePersonalProject(user.token, "over-4");
    expect(cappedAgain.status).toBe(402);

    const list = await call(routes.projects.GET, {
      method: "GET",
      path: "/api/v1/projects",
      token: user.token,
    });
    expect(list.body.projects.length).toBe(cap + 3); // nothing deleted
  });

  it("Team tier caps members; upgrading raises the cap, downgrading is guarded", async () => {
    const owner = await registerUserWithKeypair("tier owner passphrase");
    const { orgId } = await createRawOrg(owner);
    await fireSubscriptionWebhook(orgId, { tier: "STARTER" });

    // Owner is member #1; fill to the STARTER cap (10) with pending invites.
    await db.organizationInvite.createMany({
      data: Array.from({ length: 9 }, () => ({
        organizationId: orgId,
        email: `filler_${randomUUID()}@example.com`,
        role: "MEMBER" as const,
        tokenHash: `hash_${randomUUID()}`,
        tokenPrefix: "oiv_xxxx",
        expiresAt: new Date(Date.now() + 7 * 864e5),
      })),
    });

    const bob = await registerUserWithKeypair("bob tier passphrase");
    const invitePath = `/api/v1/organizations/${orgId}/invites`;
    const inviteBob = () =>
      call(routes.orgInvites.POST, {
        method: "POST",
        path: invitePath,
        params: { id: orgId },
        token: owner.token,
        body: { email: bob.email, role: "MEMBER" },
      });

    // 1 owner + 9 pending = 10 = STARTER cap → 402.
    expect((await inviteBob()).status).toBe(402);

    // Upgrade to GROWTH. change-tier calls polar (mocked); our tier only
    // moves on the webhook — simulate the `subscription.updated`.
    const change = await call(routes.changeTier, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/billing/change-tier`,
      params: { id: orgId },
      token: owner.token,
      body: { tier: "GROWTH" },
    });
    expect(change.status).toBe(200);
    await fireSubscriptionWebhook(orgId, { type: "subscription.updated", tier: "GROWTH" });

    // Now under the GROWTH cap (25) → invite allowed.
    expect((await inviteBob()).status).toBe(201);

    // Downgrade to STARTER refused — the org now has 11 seats.
    const downgrade = await call(routes.changeTier, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/billing/change-tier`,
      params: { id: orgId },
      token: owner.token,
      body: { tier: "STARTER" },
    });
    expect(downgrade.status).toBe(409);

    // Billing DTO reflects the current tier.
    const billing = await call(routes.orgBilling, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}/billing`,
      params: { id: orgId },
      token: owner.token,
    });
    expect(billing.body.subscription.tier).toBe("GROWTH");
  });

  it("purge-pending-orgs requires the CRON_SECRET", async () => {
    const unauth = new NextRequest("http://localhost/api/v1/internal/purge-pending-orgs", {
      method: "GET",
      headers: { authorization: "Bearer wrong" },
    });
    const res = await routes.purgeCron(unauth, { params: {} });
    expect(res.status).toBe(401);

    const authed = new NextRequest("http://localhost/api/v1/internal/purge-pending-orgs", {
      method: "GET",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const ok = await routes.purgeCron(authed, { params: {} });
    expect(ok.status).toBe(200);
  });

  it("immediately invalidates a revoked session's access token", async () => {
    const { token } = await registerUser("revocation test vault passphrase");
    const sessionsRes = await call(routes.sessions, {
      method: "GET",
      path: "/api/v1/auth/sessions",
      token,
    });
    const current = sessionsRes.body.sessions.find((s: { current: boolean }) => s.current);
    expect(current).toBeTruthy();

    const revokeRes = await call(routes.revokeSession, {
      method: "DELETE",
      path: `/api/v1/auth/sessions/${current.id}`,
      params: { id: current.id },
      token,
    });
    expect(revokeRes.status).toBe(204);

    const meRes = await call(routes.me, { method: "GET", path: "/api/v1/auth/me", token });
    expect(meRes.status).toBe(401);
  });
});
