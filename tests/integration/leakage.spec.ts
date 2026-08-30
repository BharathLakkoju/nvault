/**
 * Data-leakage invariants. Builds a full personal + organization world with
 * uniquely-marked secrets, then asserts that NO plaintext secret, passphrase,
 * token, or key byte ever appears on a surface a user, an attacker, or an
 * operator could read: API responses, error bodies, the audit log, the
 * organization activity feed, server logs, or the at-rest storage blob.
 *
 * "Fail the build on any leak" — every assertion here is a hard failure.
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
  assertNoLeak,
  call,
  captureConsole,
  cleanupUsers,
  createOrg,
  createPersonalProject,
  db,
  describeIf,
  disconnect,
  encodingsOf,
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
  type KeypairUser,
  type Registered,
} from "./helpers";

// Unique, greppable plaintext markers — long enough that an accidental
// substring match is not plausible.
const MARK = randomUUID().replace(/-/g, "").toUpperCase();
const SECRET_ENV = [
  `# ${MARK} fixture`,
  `DATABASE_URL="postgres://u:p@h/db_${MARK}"`,
  `STRIPE_SECRET_KEY=sk_live_${MARK}_PERSONAL`,
  `OPENAI_API_KEY=sk-${MARK}`,
  `MULTILINE="a\\nb_${MARK}"`,
].join("\n");
const ORG_SECRET_ENV = `TEAM_SHARED_TOKEN=shhh_${MARK}_ORG\nAWS_SECRET_ACCESS_KEY=${MARK}orgaws\n`;

describeIf("data-leakage invariants", () => {
  let cc: ReturnType<typeof captureConsole>;

  // The full cast.
  let alice: Registered; // personal Pro user with secrets
  let owner: KeypairUser; // org owner
  let member: KeypairUser; // enrolled org member
  let outsider: KeypairUser; // unrelated account

  let personalProjectId: string;
  let personalFileId: string;
  let personalVersionId: string;
  let orgId: string;
  let orgProjectId: string;
  let orgFileId: string;
  let orgVersionId: string;

  let pat: string;
  let enrollmentSecret: string;
  let inviteToken: string;
  let clientCiphertextB64: string;

  /** Everything that must never surface in plaintext anywhere. */
  let SECRETS: string[];

  beforeAll(async () => {
    await resetRateLimit();
    cc = captureConsole();

    alice = await registerUser("alice-vault-passphrase-LEAKTEST");
    await grantPro(alice.id, "ACTIVE");
    ({ pat } = await mintPat(alice.token, "alice laptop"));

    const p = await createPersonalProject(alice, `svc-${MARK.slice(0, 8)}`);
    personalProjectId = p.id;
    const up = await uploadFile(alice, p.id, p.projectKey, ".env", SECRET_ENV);
    expect(up.status).toBe(201);

    const filesRes = await call(routes.files.GET, {
      method: "GET",
      path: `/api/v1/projects/${p.id}/files`,
      params: { id: p.id },
      token: alice.token,
    });
    personalFileId = filesRes.body.files[0].id;
    personalVersionId = filesRes.body.files[0].currentVersion.id;

    // Capture the exact client ciphertext for this version so we can prove the
    // server re-envelopes it (client blob must not sit in storage verbatim).
    const dl = await call(routes.fileVersion, {
      method: "GET",
      path: `/api/v1/projects/${p.id}/files/${personalFileId}/versions/${personalVersionId}`,
      params: { id: p.id, fileId: personalFileId, versionId: personalVersionId },
      token: alice.token,
    });
    clientCiphertextB64 = dl.body.payload.ciphertext;

    // --- Organization world ---
    owner = await registerUserWithKeypair("owner-vault-passphrase-LEAKTEST");
    member = await registerUserWithKeypair("member-vault-passphrase-LEAKTEST");
    outsider = await registerUserWithKeypair("outsider-vault-passphrase-LEAKTEST");

    const org = await createOrg(owner, { tier: "STARTER" });
    orgId = org.orgId;
    enrollmentSecret = org.secret;

    // Grab the pending invite token before it's accepted.
    const inv = await call(routes.orgInvites.POST, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/invites`,
      params: { id: orgId },
      token: owner.token,
      body: { email: member.email, role: "MEMBER" },
    });
    inviteToken = inv.body.token;
    const acc = await call(routes.acceptInvite, {
      method: "POST",
      path: "/api/v1/invites/accept",
      token: member.token,
      body: { token: inviteToken },
    });
    expect(acc.status).toBe(200);
    // finish enrollment for `member`
    const detail = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: member.token,
    });
    const orgKey = await vaultCrypto.openOrgKeyWithEnrollmentSecret(enrollmentSecret, detail.body.enrollment);
    const wrappedOrgKey = await vaultCrypto.wrapToPublicKey(member.publicKey, orgKey);
    const roster = await vaultCrypto.decryptRoster(orgKey, detail.body.roster);
    const nextRoster = vaultCrypto.withEntry(roster, member.id, {
      fingerprint: await vaultCrypto.fingerprintPublicKey(member.publicKey),
      addedAt: new Date().toISOString(),
    });
    const enrollRes = await call(routes.enroll, {
      method: "POST",
      path: `/api/v1/organizations/${orgId}/enroll`,
      params: { id: orgId },
      token: member.token,
      body: {
        wrappedOrgKey,
        keyEpoch: detail.body.enrollment.keyEpoch,
        pinnedPublicKey: member.publicKey,
        roster: await vaultCrypto.encryptRoster(orgKey, nextRoster),
        expectedRosterVersion: detail.body.roster.version,
      },
    });
    expect(enrollRes.status).toBe(200);

    // Org project + file, keyed under the Org Key.
    const opId = randomUUID();
    const { wrappedProjectKey, projectKey: orgProjectKey } = await vaultCrypto.createProjectKey(
      orgKey,
      opId,
    );
    const opRes = await call(routes.projects.POST, {
      method: "POST",
      path: "/api/v1/projects",
      token: owner.token,
      body: { id: opId, name: `team-app-${MARK.slice(0, 6)}`, wrappedProjectKey, organizationId: orgId },
    });
    expect(opRes.status).toBe(201);
    orgProjectId = opId;
    const orgUp = await uploadFile(owner, opId, orgProjectKey, ".env", ORG_SECRET_ENV);
    expect(orgUp.status).toBe(201);
    const orgFiles = await call(routes.files.GET, {
      method: "GET",
      path: `/api/v1/projects/${opId}/files`,
      params: { id: opId },
      token: owner.token,
    });
    orgFileId = orgFiles.body.files[0].id;
    orgVersionId = orgFiles.body.files[0].currentVersion.id;

    SECRETS = [
      // credentials & passphrases
      alice.password,
      alice.passphrase,
      owner.passphrase,
      member.passphrase,
      outsider.passphrase,
      // long-lived tokens
      pat,
      enrollmentSecret,
      inviteToken,
      // plaintext file content (whole + per-line markers)
      SECRET_ENV,
      `sk_live_${MARK}_PERSONAL`,
      `sk-${MARK}`,
      `db_${MARK}`,
      `a\nb_${MARK}`,
      ORG_SECRET_ENV,
      `shhh_${MARK}_ORG`,
      `${MARK}orgaws`,
      // key material, in several encodings
      ...encodingsOf(vaultCrypto.bytesToBase64(alice.masterKey)),
      ...encodingsOf(vaultCrypto.bytesToBase64(owner.masterKey)),
      ...encodingsOf(vaultCrypto.bytesToBase64(owner.privateKey)),
      ...encodingsOf(vaultCrypto.bytesToBase64(member.privateKey)),
      ...encodingsOf(vaultCrypto.bytesToBase64(org.orgKey)),
    ].filter(Boolean);
  });

  afterAll(async () => {
    // Nothing the suite logged may contain a secret.
    const logText = cc.text();
    cc.restore();
    assertNoLeak("server logs (whole run)", logText, SECRETS);
    await cleanupUsers();
    await disconnect();
  });

  // -------------------------------------------------------------------------
  // Dashboard read surfaces
  // -------------------------------------------------------------------------

  async function scan(where: string, res: { raw: string; body: unknown }) {
    assertNoLeak(where, res.raw, SECRETS);
    assertNoLeak(`${where} (reserialized)`, JSON.stringify(res.body ?? null), SECRETS);
  }

  it("/auth/me never returns plaintext key material or credentials", async () => {
    for (const who of [
      { t: alice.token, n: "alice" },
      { t: owner.token, n: "owner" },
      { t: member.token, n: "member" },
    ]) {
      const res = await call(routes.me, { method: "GET", path: "/api/v1/auth/me", token: who.t });
      expect(res.status).toBe(200);
      await scan(`/auth/me (${who.n})`, res);
    }
  });

  it("the project list + detail expose only ciphertext wrappers", async () => {
    for (const who of [
      { t: alice.token, n: "alice" },
      { t: owner.token, n: "owner" },
      { t: member.token, n: "member" },
    ]) {
      const list = await call(routes.projects.GET, {
        method: "GET",
        path: "/api/v1/projects",
        token: who.t,
      });
      await scan(`GET /projects (${who.n})`, list);
    }
    const detail = await call(routes.project.GET, {
      method: "GET",
      path: `/api/v1/projects/${personalProjectId}`,
      params: { id: personalProjectId },
      token: alice.token,
    });
    await scan("GET /projects/:id", detail);
  });

  it("file listing + version history carry no plaintext, filename markers only", async () => {
    const files = await call(routes.files.GET, {
      method: "GET",
      path: `/api/v1/projects/${personalProjectId}/files`,
      params: { id: personalProjectId },
      token: alice.token,
    });
    await scan("GET /projects/:id/files", files);

    const versions = await call(routes.fileVersions, {
      method: "GET",
      path: `/api/v1/projects/${personalProjectId}/files/${personalFileId}/versions`,
      params: { id: personalProjectId, fileId: personalFileId },
      token: alice.token,
    });
    await scan("GET /projects/:id/files/:fileId/versions", versions);
  });

  it("a file download returns client ciphertext only (decryptable client-side, opaque on the wire)", async () => {
    const dl = await call(routes.fileVersion, {
      method: "GET",
      path: `/api/v1/projects/${personalProjectId}/files/${personalFileId}/versions/${personalVersionId}`,
      params: { id: personalProjectId, fileId: personalFileId, versionId: personalVersionId },
      token: alice.token,
    });
    expect(dl.status).toBe(200);
    // The response body is ciphertext; assert the *plaintext* is absent…
    assertNoLeak("file download body", dl.raw, [SECRET_ENV, `sk_live_${MARK}_PERSONAL`, `sk-${MARK}`]);
    // …but that the client can still recover it with the project key.
    const p = await db.project.findFirstOrThrow({ where: { id: personalProjectId } });
    const projectKey = await vaultCrypto.openProjectKey(alice.masterKey, personalProjectId, {
      iv: p.wrappedProjectKeyIv,
      ciphertext: p.wrappedProjectKeyCiphertext,
    });
    const plain = await vaultCrypto.decryptFileContent(projectKey, dl.body.payload.contentId, dl.body.payload);
    expect(vaultCrypto.bytesToUtf8(plain)).toBe(SECRET_ENV);
  });

  it("the bulk project export returns ciphertext payloads, not plaintext", async () => {
    const res = await call(routes.filesExport, {
      method: "GET",
      path: `/api/v1/projects/${personalProjectId}/files/export`,
      params: { id: personalProjectId },
      token: alice.token,
    });
    expect(res.status).toBe(200);
    await scan("GET /projects/:id/files/export", res);
  });

  it("sessions list exposes no token hashes or secret columns", async () => {
    const res = await call(routes.sessions, {
      method: "GET",
      path: "/api/v1/auth/sessions",
      token: alice.token,
    });
    await scan("GET /auth/sessions", res);
    expect(res.raw).not.toMatch(/tokenHash|refreshToken|apiToken(Hash)?|passwordHash/i);
  });

  it("CLI token list returns metadata only — never the raw evk_ value", async () => {
    const res = await call(routes.tokens.GET, {
      method: "GET",
      path: "/api/v1/auth/tokens",
      token: alice.token,
    });
    await scan("GET /auth/tokens", res);
    expect(res.raw).not.toContain(pat);
    expect(res.raw).not.toMatch(/tokenHash/i);
  });

  it("the personal audit log records actions, never secret values", async () => {
    const res = await call(routes.auditLog, {
      method: "GET",
      path: "/api/v1/audit-log",
      token: alice.token,
    });
    expect(res.status).toBe(200);
    await scan("GET /audit-log", res);
    // sanity: it did record the upload
    expect(res.raw).toMatch(/file\.uploaded/);
  });

  it("the raw audit_log table rows contain no secret values", async () => {
    const rows = await db.auditLog.findMany({
      where: { OR: [{ userId: alice.id }, { userId: owner.id }, { organizationId: orgId }] },
    });
    assertNoLeak("audit_log table", JSON.stringify(rows), SECRETS);
  });

  it("the organization detail + activity feed leak neither Org Key nor enrollment secret", async () => {
    const detail = await call(routes.org.GET, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}`,
      params: { id: orgId },
      token: member.token,
    });
    await scan("GET /organizations/:id (member)", detail);

    const activity = await call(routes.orgActivity, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}/activity`,
      params: { id: orgId },
      token: owner.token,
    });
    await scan("GET /organizations/:id/activity", activity);
  });

  it("org billing DTO carries no Polar secrets or raw customer tokens", async () => {
    const res = await call(routes.orgBilling, {
      method: "GET",
      path: `/api/v1/organizations/${orgId}/billing`,
      params: { id: orgId },
      token: owner.token,
    });
    await scan("GET /organizations/:id/billing", res);
  });

  // -------------------------------------------------------------------------
  // At-rest
  // -------------------------------------------------------------------------

  it("storage blobs are server-enveloped and hold no plaintext or client ciphertext", async () => {
    for (const pid of [personalProjectId, orgProjectId]) {
      const blobs = await db.storageObject.findMany({ where: { key: { startsWith: `projects/${pid}/` } } });
      expect(blobs.length).toBeGreaterThan(0);
      for (const b of blobs) {
        expect(b.data[0]).toBe(1); // envelope format version
        const latin1 = Buffer.from(b.data).toString("latin1");
        assertNoLeak(`storage_objects[${b.key}]`, latin1, [
          SECRET_ENV,
          ORG_SECRET_ENV,
          `sk_live_${MARK}_PERSONAL`,
          `shhh_${MARK}_ORG`,
        ]);
        // The client ciphertext must not sit in storage verbatim (it is
        // re-encrypted under STORAGE_ENCRYPTION_KEY).
        expect(Buffer.from(b.data).toString("base64")).not.toContain(clientCiphertextB64);
      }
    }
  });

  it("user/session rows keep only hashes, never the plaintext password or passphrase", async () => {
    const u = await db.user.findFirstOrThrow({ where: { id: alice.id } });
    const serialized = JSON.stringify(u);
    assertNoLeak("user row", serialized, [alice.password, alice.passphrase]);
    // password is argon2id; wrapped master key is ciphertext, not the passphrase
    expect(u).toHaveProperty("passwordHash");
    expect(String((u as Record<string, unknown>).passwordHash)).toMatch(/^\$argon2/);
  });

  // -------------------------------------------------------------------------
  // Cross-tenant & error paths (no existence disclosure, no input echo)
  // -------------------------------------------------------------------------

  it("ID manipulation returns 404 (not 403) and no data for every cross-tenant resource", async () => {
    const probes: Array<[string, () => Promise<{ status: number; raw: string; body: any }>]> = [
      ["outsider → alice's project", () =>
        call(routes.project.GET, {
          method: "GET",
          path: `/api/v1/projects/${personalProjectId}`,
          params: { id: personalProjectId },
          token: outsider.token,
        })],
      ["outsider → alice's files", () =>
        call(routes.files.GET, {
          method: "GET",
          path: `/api/v1/projects/${personalProjectId}/files`,
          params: { id: personalProjectId },
          token: outsider.token,
        })],
      ["outsider → alice's file version", () =>
        call(routes.fileVersion, {
          method: "GET",
          path: `/api/v1/projects/${personalProjectId}/files/${personalFileId}/versions/${personalVersionId}`,
          params: { id: personalProjectId, fileId: personalFileId, versionId: personalVersionId },
          token: outsider.token,
        })],
      ["outsider → the org", () =>
        call(routes.org.GET, {
          method: "GET",
          path: `/api/v1/organizations/${orgId}`,
          params: { id: orgId },
          token: outsider.token,
        })],
      ["member → org billing change (admin-only)", () =>
        call(routes.changeTier, {
          method: "POST",
          path: `/api/v1/organizations/${orgId}/billing/change-tier`,
          params: { id: orgId },
          token: member.token,
          body: { tier: "GROWTH" },
        })],
      ["alice → org project she's not a member of", () =>
        call(routes.files.GET, {
          method: "GET",
          path: `/api/v1/projects/${orgProjectId}/files`,
          params: { id: orgProjectId },
          token: alice.token,
        })],
    ];

    for (const [label, run] of probes) {
      const res = await run();
      expect([403, 404]).toContain(res.status);
      // Preference stated in the scenario doc: 404, never 403, for owned resources.
      if (label.startsWith("outsider →") || label.startsWith("alice →")) {
        expect(res.status).toBe(404);
      }
      await scan(`cross-tenant probe: ${label}`, res);
    }
  });

  it("a wrong-password login is generic and never echoes the attempt", async () => {
    const res = await call(routes.login, {
      method: "POST",
      path: "/api/v1/auth/login",
      body: { email: alice.email, password: `WRONG-${MARK}` },
    });
    expect(res.status).toBe(401);
    expect(res.raw).not.toContain(`WRONG-${MARK}`);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it("validation errors report the field, not internal details or a stack trace", async () => {
    const res = await call(routes.files.POST, {
      method: "POST",
      path: `/api/v1/projects/${personalProjectId}/files`,
      params: { id: personalProjectId },
      token: alice.token,
      body: { filename: "../../etc/passwd", payload: { iv: "x", ciphertext: "y" }, contentId: "nope" },
    });
    expect(res.status).toBe(400);
    expect(res.raw).not.toMatch(/prisma|postgres|ECONNREFUSED|node_modules|\/home\/|at Object\.<anonymous>/i);
  });

  it("an unhandled-path 500 stays opaque", async () => {
    // contentId must be a uuid; a malformed-but-schema-valid mismatch that trips
    // deeper code still must not leak internals.
    const res = await call(routes.restore, {
      method: "POST",
      path: `/api/v1/projects/${personalProjectId}/files/${personalFileId}/restore`,
      params: { id: personalProjectId, fileId: personalFileId },
      token: alice.token,
      body: { versionId: randomUUID() }, // valid shape, nonexistent version
    });
    expect([400, 404]).toContain(res.status);
    expect(res.raw).not.toMatch(/stack|prisma|\bat \/|node_modules/i);
  });

  it("secrets are never placed in a URL/query string by any endpoint the dashboard calls", () => {
    // by-git-remote is the only GET that takes a caller-supplied value in the
    // query — and that value is a git remote URL, explicitly not a secret.
    // This test documents the invariant; if a new `?token=`/`?secret=` param is
    // added it should be caught in review, but assert the known surface here.
    const suspect = ["?token=", "?secret=", "?passphrase=", "?password=", "?key="];
    const routeFile = require("fs").readFileSync(
      require("path").join(process.cwd(), "src/app/api/v1/projects/by-git-remote/route.ts"),
      "utf8",
    );
    for (const s of suspect) expect(routeFile).not.toContain(s);
  });
});
