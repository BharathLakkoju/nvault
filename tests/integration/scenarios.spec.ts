/**
 * One test per persona in docs/test-scenarios.md, asserting the "Expected:"
 * line for each. This is the dashboard's data/authorization boundary: the web
 * UI is a thin client over these same Route Handlers, so a green run here means
 * every scenario behaves correctly for the dashboard too.
 *
 * Deeper mechanism coverage (webhook idempotency, key rotation, byte
 * preservation, envelope-at-rest) lives in api.spec.ts and leakage.spec.ts;
 * this file is the persona checklist.
 *
 * Requires DATABASE_URL (tests/integration/setup.ts). Skipped otherwise.
 */
import { randomUUID } from "node:crypto";

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

import {
  call,
  cleanupUsers,
  createOrg,
  createPersonalProject,
  db,
  describeIf,
  disconnect,
  fireOrgWebhook,
  fireProWebhook,
  grantPro,
  inviteAndEnroll,
  loginUser,
  mintPat,
  registerUser,
  registerUserWithKeypair,
  resetRateLimit,
  routes,
  uploadFile,
  vaultCrypto,
} from "./helpers";

describeIf("test-scenarios.md persona checklist", () => {
  beforeEach(() => resetRateLimit());
  afterAll(async () => {
    await cleanupUsers();
    await disconnect();
  });

  const listProjects = (token: string) =>
    call(routes.projects.GET, { method: "GET", path: "/api/v1/projects", token });
  const newProject = async (token: string, name: string, wrappedProjectKey: unknown) =>
    call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token,
      body: { id: randomUUID(), name, wrappedProjectKey },
    });
  const anyWrappedKey = async () =>
    (await vaultCrypto.createProjectKey(vaultCrypto.generateDataKey(), randomUUID())).wrappedProjectKey;

  // --- Free tier ---------------------------------------------------------------

  it("free-newcomer: empty account — no keypair, no projects, cannot start an org", async () => {
    const u = await registerUser("free newcomer passphrase");
    const projects = await listProjects(u.token);
    expect(projects.body.projects).toHaveLength(0);

    const kp = await call(routes.keypair.GET, {
      method: "GET",
      path: "/api/v1/auth/vault/keypair",
      token: u.token,
    });
    expect(kp.body.keyPairMaterial).toBeNull();

    // Creating an org requires a provisioned keypair (to hold a wrapped Org Key).
    const org = await call(routes.orgs.POST, {
      method: "POST",
      path: "/api/v1/organizations",
      token: u.token,
      body: { name: "Nope", slug: `nope-${randomUUID().slice(0, 8)}` },
    });
    expect(org.status).toBeGreaterThanOrEqual(400);
  });

  it("free-active: a healthy account under every cap can read its plan DTO", async () => {
    const u = await registerUser("free active passphrase");
    const p1 = await createPersonalProject(u, "portfolio-site");
    await createPersonalProject(u, "api-gateway");
    await uploadFile(u, p1.id, p1.projectKey, ".env", "A=1\n");
    await uploadFile(u, p1.id, p1.projectKey, ".env", "A=2\n");

    const plan = await call(routes.plan, { method: "GET", path: "/api/v1/billing/plan", token: u.token });
    expect(plan.status).toBe(200);
    expect(plan.body.plan ?? plan.body.tier ?? "FREE").toMatch(/free/i);
    const list = await listProjects(u.token);
    expect(list.body.projects).toHaveLength(2);
  });

  it("free-projects-maxed: 3 projects held, the 4th create → 402", async () => {
    const u = await registerUser("free projects maxed passphrase");
    for (let i = 0; i < 3; i++) expect((await newProject(u.token, `p${i}`, await anyWrappedKey())).status).toBe(201);
    expect((await newProject(u.token, "p4", await anyWrappedKey())).status).toBe(402);
  });

  it("free-versions-maxed: 3rd upload AND restore → 402; history is trimmed + capped", async () => {
    const u = await registerUser("free versions maxed passphrase");
    const p = await createPersonalProject(u, "web-app");
    expect((await uploadFile(u, p.id, p.projectKey, ".env", "N=1")).status).toBe(201);
    expect((await uploadFile(u, p.id, p.projectKey, ".env", "N=2")).status).toBe(201);
    expect((await uploadFile(u, p.id, p.projectKey, ".env", "N=3")).status).toBe(402);

    const files = await call(routes.files.GET, {
      method: "GET",
      path: `/api/v1/projects/${p.id}/files`,
      params: { id: p.id },
      token: u.token,
    });
    const fileId = files.body.files[0].id;
    const versions = await call(routes.fileVersions, {
      method: "GET",
      path: `/api/v1/projects/${p.id}/files/${fileId}/versions`,
      params: { id: p.id, fileId },
      token: u.token,
    });
    expect(versions.body.versions).toHaveLength(2);
    expect(versions.body.capped).toBe(true);

    const oldest = versions.body.versions.find((v: { isCurrent: boolean }) => !v.isCurrent);
    const restore = await call(routes.restore, {
      method: "POST",
      path: `/api/v1/projects/${p.id}/files/${fileId}/restore`,
      params: { id: p.id, fileId },
      token: u.token,
      body: { versionId: oldest.id },
    });
    expect(restore.status).toBe(402);
  });

  it("free-devices-maxed: a 3rd browser sign-in evicts the least-recently-used session", async () => {
    const u = await registerUser("free devices maxed passphrase");
    const t1 = await loginUser(u.email, u.password);
    const t2 = await loginUser(u.email, u.password);
    const t3 = await loginUser(u.email, u.password);

    expect((await call(routes.me, { method: "GET", path: "/api/v1/auth/me", token: t1 })).status).toBe(401);
    for (const t of [t2, t3]) {
      expect((await call(routes.me, { method: "GET", path: "/api/v1/auth/me", token: t })).status).toBe(200);
    }
  });

  it("free-no-cli: CLI access is paid — PAT creation is refused with 402 until the account has Pro", async () => {
    const u = await registerUser("free cli passphrase");

    const blocked = await call(routes.tokens.POST, {
      method: "POST",
      path: "/api/v1/auth/tokens",
      token: u.token,
      body: { name: "laptop" },
    });
    expect(blocked.status).toBe(402);

    const list = await call(routes.tokens.GET, {
      method: "GET",
      path: "/api/v1/auth/tokens",
      token: u.token,
    });
    expect(list.body.cliAccess).toBe(false);
    expect(list.body.tokens).toHaveLength(0);

    // Grant Pro -> creation now works, up to the Pro ceiling.
    await grantPro(u.id, "ACTIVE");
    const ok = await mintPat(u.token, "laptop");
    expect(ok.pat).toMatch(/^evk_/);
  });

  // --- Pro tier ---------------------------------------------------------------

  it("pro-active: ACTIVE subscription lifts the personal-project cap", async () => {
    const u = await registerUser("pro active passphrase");
    await grantPro(u.id, "ACTIVE");
    for (let i = 0; i < 5; i++) expect((await newProject(u.token, `pp${i}`, await anyWrappedKey())).status).toBe(201);
    const sub = await call(routes.personalSub, {
      method: "GET",
      path: "/api/v1/billing/subscription",
      token: u.token,
    });
    expect(sub.body.pro.status).toBe("ACTIVE");
  });

  it("pro-past-due: entitlement is still granted during the dunning window", async () => {
    const u = await registerUser("pro past due passphrase");
    await grantPro(u.id, "PAST_DUE");
    for (let i = 0; i < 4; i++) expect((await newProject(u.token, `pd${i}`, await anyWrappedKey())).status).toBe(201);
  });

  it("pro-canceled: cap reinstated, but nothing is deleted", async () => {
    const u = await registerUser("pro canceled passphrase");
    await grantPro(u.id, "ACTIVE");
    for (let i = 0; i < 5; i++) expect((await newProject(u.token, `pc${i}`, await anyWrappedKey())).status).toBe(201);

    await db.subscription.updateMany({ where: { ownerUserId: u.id }, data: { status: "CANCELED" } });

    expect((await newProject(u.token, "pc-new", await anyWrappedKey())).status).toBe(402);
    expect((await listProjects(u.token)).body.projects).toHaveLength(5); // retained
  });

  it("pro-pending: a PENDING checkout row grants nothing — behaves exactly like Free", async () => {
    const u = await registerUser("pro pending passphrase");
    await grantPro(u.id, "PENDING");
    for (let i = 0; i < 3; i++) expect((await newProject(u.token, `pn${i}`, await anyWrappedKey())).status).toBe(201);
    expect((await newProject(u.token, "pn4", await anyWrappedKey())).status).toBe(402);
  });

  // --- Team / organizations -------------------------------------------------

  it("org-owner (STARTER, ACTIVE): caller is OWNER/ACTIVE and can reach billing", async () => {
    const owner = await registerUserWithKeypair("org owner passphrase");
    const { orgId } = await createOrg(owner, { tier: "STARTER" });
    const detail = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: owner.token,
    });
    expect(detail.body.self.role).toBe("OWNER");
    expect(detail.body.self.status).toBe("ACTIVE");
    const billing = await call(routes.orgBilling, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}/billing`,
      params: { id: orgId },
      token: owner.token,
    });
    expect(billing.status).toBe(200);
  });

  it("org-admin: can manage members + projects, but billing/delete-org → 403", async () => {
    const owner = await registerUserWithKeypair("org admin owner");
    const admin = await registerUserWithKeypair("org admin member");
    const { orgId, secret } = await createOrg(owner, { tier: "STARTER" });
    await inviteAndEnroll(owner, orgId, secret, admin, "ADMIN");

    const guest = await registerUserWithKeypair("org admin guest");
    const invite = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: admin.token,
      body: { email: guest.email, role: "MEMBER" },
    });
    expect(invite.status).toBe(201);

    const billing = await call(routes.changeTier, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/billing/change-tier`,
      params: { id: orgId },
      token: admin.token,
      body: { tier: "GROWTH" },
    });
    expect(billing.status).toBe(403);

    const del = await call(routes.org.DELETE, {
      method: "DELETE",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: admin.token,
    });
    expect(del.status).toBe(403);
  });

  it("org-member: read/write org files, but create-invite + create-project → 403", async () => {
    const owner = await registerUserWithKeypair("org member owner");
    const member = await registerUserWithKeypair("org member member");
    const { orgId, orgKey, secret } = await createOrg(owner, { tier: "STARTER" });
    await inviteAndEnroll(owner, orgId, secret, member, "MEMBER");

    // owner seeds an org project
    const pid = randomUUID();
    const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(orgKey, pid);
    await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: owner.token,
      body: { id: pid, name: "shared", wrappedProjectKey, organizationId: orgId },
    });

    // member can write a file
    const up = await uploadFile(member, pid, projectKey, ".env", "TEAM=yes\n");
    expect(up.status).toBe(201);

    // member cannot invite
    const inv = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: member.token,
      body: { email: "x@example.com", role: "MEMBER" },
    });
    expect(inv.status).toBe(403);

    // member cannot create an org project
    const proj = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: member.token,
      body: {
        id: randomUUID(),
        name: "member-made",
        wrappedProjectKey: await vaultCrypto
          .createProjectKey(orgKey, randomUUID())
          .then((r) => r.wrappedProjectKey),
        organizationId: orgId,
      },
    });
    expect(proj.status).toBe(403);
  });

  it("org-invited: accepted but not enrolled — org projects are invisible until enrollment", async () => {
    const owner = await registerUserWithKeypair("org invited owner");
    const invitee = await registerUserWithKeypair("org invited member");
    const { orgId, orgKey, secret } = await createOrg(owner, { tier: "STARTER" });

    const pid = randomUUID();
    const { wrappedProjectKey } = await vaultCrypto.createProjectKey(orgKey, pid);
    await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: owner.token,
      body: { id: pid, name: "secret-proj", wrappedProjectKey, organizationId: orgId },
    });

    const invite = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: owner.token,
      body: { email: invitee.email, role: "MEMBER" },
    });
    await call(routes.acceptInvite, {
      method: "POST",
      path: "/api/v1/invites/accept",
      token: invitee.token,
      body: { token: invite.body.token },
    });

    // INVITED, holds no Org Key → project hidden
    const before = await listProjects(invitee.token);
    expect(before.body.projects.some((p: { id: string }) => p.id === pid)).toBe(false);
    const detailBefore = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: invitee.token,
    });
    expect(detailBefore.body.self.status).toBe("INVITED");
    expect(detailBefore.body.self.wrappedOrgKey).toBeNull();

    // Now enroll with the Enrollment Secret → membership flips to ACTIVE.
    const d = detailBefore.body;
    const k = await vaultCrypto.openOrgKeyWithEnrollmentSecret(secret, d.enrollment);
    const roster = await vaultCrypto.decryptRoster(k, d.roster);
    const next = vaultCrypto.withEntry(roster, invitee.id, {
      fingerprint: await vaultCrypto.fingerprintPublicKey(invitee.publicKey),
      addedAt: new Date().toISOString(),
    });
    const enrollRes = await call(routes.enroll, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/enroll`,
      params: { id: orgId },
      token: invitee.token,
      body: {
        wrappedOrgKey: await vaultCrypto.wrapToPublicKey(invitee.publicKey, k),
        keyEpoch: d.enrollment.keyEpoch,
        pinnedPublicKey: invitee.publicKey,
        roster: await vaultCrypto.encryptRoster(k, next),
        expectedRosterVersion: d.roster.version,
      },
    });
    expect(enrollRes.status).toBe(200);

    const after = await listProjects(invitee.token);
    expect(after.body.projects.some((p: { id: string }) => p.id === pid)).toBe(true);
  });

  it("org-pending-invite: wrong account redeeming the link → 403; correct account → INVITED", async () => {
    const owner = await registerUserWithKeypair("pending invite owner");
    const target = await registerUserWithKeypair("pending invite target");
    const wrong = await registerUserWithKeypair("pending invite wrong");
    const { orgId } = await createOrg(owner, { tier: "STARTER" });

    const invite = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: owner.token,
      body: { email: target.email, role: "MEMBER" },
    });
    const token = invite.body.token;

    const wrongAccept = await call(routes.acceptInvite, {
      method: "POST",
      path: "/api/v1/invites/accept",
      token: wrong.token,
      body: { token },
    });
    expect(wrongAccept.status).toBe(403);

    const rightAccept = await call(routes.acceptInvite, {
      method: "POST",
      path: "/api/v1/invites/accept",
      token: target.token,
      body: { token },
    });
    expect(rightAccept.status).toBe(200);

    // single-use
    const reuse = await call(routes.acceptInvite, {
      method: "POST",
      path: "/api/v1/invites/accept",
      token: target.token,
      body: { token },
    });
    expect(reuse.status).toBe(404);
  });

  it("org-owner-pending (PENDING_PAYMENT): every org write → 402, GET billing → 200 with CTA", async () => {
    const owner = await registerUserWithKeypair("org pending owner");
    const { orgId, orgKey } = await createOrg(owner, { tier: "STARTER", activate: false });

    const proj = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: owner.token,
      body: {
        id: randomUUID(),
        name: "p",
        wrappedProjectKey: await vaultCrypto
          .createProjectKey(orgKey, randomUUID())
          .then((r) => r.wrappedProjectKey),
        organizationId: orgId,
      },
    });
    expect(proj.status).toBe(402);

    const invite = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: owner.token,
      body: { email: "x@example.com", role: "MEMBER" },
    });
    expect(invite.status).toBe(402);

    const billing = await call(routes.orgBilling, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}/billing`,
      params: { id: orgId },
      token: owner.token,
    });
    expect(billing.status).toBe(200);
    expect(billing.body.orgStatus).toBe("PENDING_PAYMENT");
  });

  it("org-owner-suspended (SUSPENDED): existing files read 200, writes 402", async () => {
    const owner = await registerUserWithKeypair("org suspended owner");
    const { orgId, orgKey } = await createOrg(owner, { tier: "STARTER" });

    const pid = randomUUID();
    const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(orgKey, pid);
    await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: owner.token,
      body: { id: pid, name: "monolith", wrappedProjectKey, organizationId: orgId },
    });
    await uploadFile(owner, pid, projectKey, ".env", "PRE=existing\n");

    // Payment lapses → SUSPENDED.
    const pastDue = await fireOrgWebhook(orgId, { type: "subscription.past_due", status: "past_due" });
    expect(pastDue.status).toBe(202);

    const read = await call(routes.files.GET, {
      method: "GET",
      path: `/api/v1/projects/${pid}/files`,
      params: { id: pid },
      token: owner.token,
    });
    expect(read.status).toBe(200);

    const write = await uploadFile(owner, pid, projectKey, ".env", "NEW=blocked\n");
    expect(write.status).toBe(402);
  });

  it("org-owner-growth (GROWTH): larger seat cap; downgrade below current headcount is refused", async () => {
    const owner = await registerUserWithKeypair("org growth owner");
    const { orgId } = await createOrg(owner, { tier: "GROWTH" });

    // Fill past the STARTER cap (10) with pending invites: 1 owner + 10 = 11.
    await db.organizationInvite.createMany({
      data: Array.from({ length: 10 }, () => ({
        organizationId: orgId,
        email: `filler_${randomUUID()}@example.com`,
        role: "MEMBER" as const,
        tokenHash: `hash_${randomUUID()}`,
        tokenPrefix: "oiv_xxxx",
        expiresAt: new Date(Date.now() + 7 * 864e5),
      })),
    });

    const downgrade = await call(routes.changeTier, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/billing/change-tier`,
      params: { id: orgId },
      token: owner.token,
      body: { tier: "STARTER" },
    });
    expect(downgrade.status).toBe(409);
  });

  it("outsider: ID manipulation against another user's / any org's resources → 404, never 403", async () => {
    const alice = await registerUser("outsider victim passphrase");
    const p = await createPersonalProject(alice, "alices-thing");
    const owner = await registerUserWithKeypair("outsider org owner");
    const { orgId } = await createOrg(owner, { tier: "STARTER" });

    const outsider = await registerUserWithKeypair("outsider passphrase");
    const probes = [
      call(routes.project.GET, {
        method: "GET",
        path: `/api/v1/projects/${p.id}`,
        params: { id: p.id },
        token: outsider.token,
      }),
      call(routes.files.GET, {
        method: "GET",
        path: `/api/v1/projects/${p.id}/files`,
        params: { id: p.id },
        token: outsider.token,
      }),
      call(routes.org.GET, {
        method: "GET",
        path: `/api/v1/organizations/${orgId}`,
        params: { id: orgId },
        token: outsider.token,
      }),
    ];
    for (const res of await Promise.all(probes)) expect((res as { status: number }).status).toBe(404);
  });
});
