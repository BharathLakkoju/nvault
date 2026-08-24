import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import express from "express";
import request from "supertest";
import * as vaultCrypto from "@envvault/crypto";
import { AppModule } from "../src/app.module";

/**
 * End-to-end tests against a real Postgres database (DATABASE_URL from
 * .env) and the real Nest application wiring — the same guards, pipes,
 * and modules main.ts boots. This is the "web/CLI -> API -> storage" path
 * CLAUDE.md calls out explicitly: encryption happens here exactly as a
 * real client would do it, and the assertions verify the server only ever
 * handles ciphertext.
 */
describe("EnvVault API (e2e)", () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(express.json({ limit: "10mb" }));
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerUser(vaultPassphrase: string) {
    const email = `e2e_${randomUUID()}@example.com`;
    const password = "e2e test account password 123";
    const provisioned = await vaultCrypto.provisionVault(vaultPassphrase);

    const res = await request(server())
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        kdfSalt: provisioned.keyMaterial.kdfSalt,
        kdfIterations: provisioned.keyMaterial.kdfIterations,
        wrappedMasterKey: provisioned.keyMaterial.wrappedMasterKey,
      })
      .expect(201);

    return { email, password, masterKey: provisioned.masterKey, accessToken: res.body.accessToken as string };
  }

  it("never echoes the account password or vault passphrase back in the register response", async () => {
    const email = `e2e_${randomUUID()}@example.com`;
    const password = "super secret account password!";
    const provisioned = await vaultCrypto.provisionVault("super secret vault passphrase!");

    const res = await request(server())
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        kdfSalt: provisioned.keyMaterial.kdfSalt,
        kdfIterations: provisioned.keyMaterial.kdfIterations,
        wrappedMasterKey: provisioned.keyMaterial.wrappedMasterKey,
      })
      .expect(201);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain(password);
    expect(body).not.toContain("super secret vault passphrase");
  });

  it("rejects login with the wrong password", async () => {
    const { email } = await registerUser("passphrase-a");
    await request(server())
      .post("/api/v1/auth/login")
      .send({ email, password: "definitely-wrong-password" })
      .expect(401);
  });

  it("rejects unauthenticated access to protected routes", async () => {
    await request(server()).get("/api/v1/projects").expect(401);
  });

  describe("project + file lifecycle", () => {
    it("stores only ciphertext, preserves content exactly, and versions non-destructively", async () => {
      const { masterKey, accessToken } = await registerUser("vault passphrase for lifecycle test");
      const auth = () => ({ Authorization: `Bearer ${accessToken}` });

      const projectId = randomUUID();
      const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(masterKey, projectId);

      const createRes = await request(server())
        .post("/api/v1/projects")
        .set(auth())
        .send({ id: projectId, name: `e2e-project-${Date.now()}`, wrappedProjectKey })
        .expect(201);
      expect(createRes.body.project.id).toBe(projectId);

      const original = '# comment\nDATABASE_URL="postgres://u:p@h/db"\nMULTILINE="a\\nb"\n';
      const contentId1 = randomUUID();
      const payload1 = await vaultCrypto.encryptFileContent(
        projectKey,
        contentId1,
        vaultCrypto.utf8ToBytes(original),
      );

      const uploadRes = await request(server())
        .post(`/api/v1/projects/${projectId}/files`)
        .set(auth())
        .send({
          filename: ".env",
          payload: payload1,
          contentId: contentId1,
          plaintextSize: original.length,
          plaintextSha256: await vaultCrypto.sha256Hex(vaultCrypto.utf8ToBytes(original)),
        })
        .expect(201);
      expect(uploadRes.body.version.versionNumber).toBe(1);

      const listRes = await request(server())
        .get(`/api/v1/projects/${projectId}/files`)
        .set(auth())
        .expect(200);
      expect(listRes.body.files).toHaveLength(1);
      expect(JSON.stringify(listRes.body)).not.toContain("DATABASE_URL");

      const fileId = listRes.body.files[0].id;
      const versionId = listRes.body.files[0].currentVersion.id;

      const downloadRes = await request(server())
        .get(`/api/v1/projects/${projectId}/files/${fileId}/versions/${versionId}`)
        .set(auth())
        .expect(200);
      const decrypted = await vaultCrypto.decryptFileContent(projectKey, contentId1, downloadRes.body.payload);
      expect(vaultCrypto.bytesToUtf8(decrypted)).toBe(original);

      // second version + restore
      const original2 = original.replace("h/db", "otherhost/db2");
      const contentId2 = randomUUID();
      const payload2 = await vaultCrypto.encryptFileContent(
        projectKey,
        contentId2,
        vaultCrypto.utf8ToBytes(original2),
      );
      await request(server())
        .post(`/api/v1/projects/${projectId}/files`)
        .set(auth())
        .send({
          filename: ".env",
          payload: payload2,
          contentId: contentId2,
          plaintextSize: original2.length,
          plaintextSha256: await vaultCrypto.sha256Hex(vaultCrypto.utf8ToBytes(original2)),
        })
        .expect(201);

      const versionsRes = await request(server())
        .get(`/api/v1/projects/${projectId}/files/${fileId}/versions`)
        .set(auth())
        .expect(200);
      expect(versionsRes.body.versions).toHaveLength(2);
      const v1 = versionsRes.body.versions.find((v: { versionNumber: number }) => v.versionNumber === 1);

      const restoreRes = await request(server())
        .post(`/api/v1/projects/${projectId}/files/${fileId}/restore`)
        .set(auth())
        .send({ versionId: v1.id })
        .expect(201);
      expect(restoreRes.body.version.versionNumber).toBe(3);

      const restoredDownload = await request(server())
        .get(`/api/v1/projects/${projectId}/files/${fileId}/versions/${restoreRes.body.version.id}`)
        .set(auth())
        .expect(200);
      const restoredPlaintext = await vaultCrypto.decryptFileContent(
        projectKey,
        restoredDownload.body.payload.contentId,
        restoredDownload.body.payload,
      );
      expect(vaultCrypto.bytesToUtf8(restoredPlaintext)).toBe(original);

      // authorization isolation
      const other = await registerUser("another user's vault passphrase");
      await request(server())
        .get(`/api/v1/projects/${projectId}`)
        .set({ Authorization: `Bearer ${other.accessToken}` })
        .expect(404);

      // path traversal rejected
      await request(server())
        .post(`/api/v1/projects/${projectId}/files`)
        .set(auth())
        .send({
          filename: "../../etc/passwd",
          payload: payload1,
          contentId: randomUUID(),
          plaintextSize: 10,
          plaintextSha256: "0".repeat(64),
        })
        .expect(400);
    });
  });

  describe("device authorization flow", () => {
    it("lets a CLI authenticate via an approved device code, without ever seeing the account password", async () => {
      const { accessToken } = await registerUser("device flow vault passphrase");

      const startRes = await request(server())
        .post("/api/v1/auth/device/start")
        .send({ deviceName: "test-host" })
        .expect(201);
      const { deviceCode, userCode } = startRes.body;

      await request(server()).post("/api/v1/auth/device/token").send({ deviceCode }).expect(400);

      await request(server())
        .post("/api/v1/auth/device/approve")
        .set({ Authorization: `Bearer ${accessToken}` })
        .send({ userCode })
        .expect(204);

      const tokenRes = await request(server())
        .post("/api/v1/auth/device/token")
        .send({ deviceCode })
        .expect(200);
      expect(tokenRes.body.accessToken).toBeTruthy();
      expect(tokenRes.body.refreshToken).toBeTruthy();

      await request(server()).post("/api/v1/auth/device/token").send({ deviceCode }).expect(400);
    });
  });

  describe("session revocation", () => {
    it("immediately invalidates a revoked session's access token", async () => {
      const { accessToken } = await registerUser("revocation test vault passphrase");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const sessionsRes = await request(server()).get("/api/v1/auth/sessions").set(auth).expect(200);
      const current = sessionsRes.body.sessions.find((s: { current: boolean }) => s.current);
      expect(current).toBeTruthy();

      await request(server()).delete(`/api/v1/auth/sessions/${current.id}`).set(auth).expect(204);
      await request(server()).get("/api/v1/auth/me").set(auth).expect(401);
    });
  });
});
