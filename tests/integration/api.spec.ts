import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import * as vaultCrypto from "@/lib/crypto";

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

describeIf("EnvVault API (integration)", () => {
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
  };

  const db = require("@/server/db").db as import("@prisma/client").PrismaClient;
  const createdUserIds: string[] = [];

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
    return { email, password, masterKey: provisioned.masterKey, token: res.body.accessToken as string };
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
    const { masterKey, token } = await registerUser("vault passphrase for lifecycle");

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
