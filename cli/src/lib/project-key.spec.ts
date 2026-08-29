import * as vaultCrypto from "@core/crypto";
import { resolveProjectKey } from "./project-key";
import type { ProjectDto } from "./types";
import type { VaultSession } from "./vault-session";

jest.mock("./api-client", () => ({ apiRequest: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiRequest } = require("./api-client") as { apiRequest: jest.Mock };

async function makeSession(): Promise<VaultSession & { publicKey: string }> {
  const { masterKey } = await vaultCrypto.provisionVault("pw");
  const kp = await vaultCrypto.provisionUserKeyPair(masterKey);
  const privateKey = await vaultCrypto.unwrapUserPrivateKey(masterKey, kp.material);
  return { masterKey, privateKey, email: "t@example.com", publicKey: kp.material.publicKey };
}

describe("resolveProjectKey", () => {
  beforeEach(() => apiRequest.mockReset());

  it("unwraps a personal project key with the master key (no API call)", async () => {
    const session = await makeSession();
    const projectId = "11111111-1111-4111-8111-111111111111";
    const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(
      session.masterKey,
      projectId,
    );
    const project = { id: projectId, wrappedProjectKey, organizationId: null } as unknown as ProjectDto;

    const resolved = await resolveProjectKey(project, session);
    expect(vaultCrypto.bytesToBase64(resolved)).toBe(vaultCrypto.bytesToBase64(projectKey));
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("unwraps an org project key via the Organization Key", async () => {
    const session = await makeSession();
    const orgKey = vaultCrypto.generateDataKey();
    const wrappedOrgKey = await vaultCrypto.wrapToPublicKey(session.publicKey, orgKey);

    const projectId = "22222222-2222-4222-8222-222222222222";
    const { wrappedProjectKey, projectKey } = await vaultCrypto.createProjectKey(orgKey, projectId);
    const project = {
      id: projectId,
      wrappedProjectKey,
      organizationId: "org_1",
      organizationName: "Acme",
    } as unknown as ProjectDto;

    apiRequest.mockResolvedValueOnce({
      self: { wrappedOrgKey, status: "ACTIVE" },
    });

    const resolved = await resolveProjectKey(project, session);
    expect(vaultCrypto.bytesToBase64(resolved)).toBe(vaultCrypto.bytesToBase64(projectKey));
    expect(apiRequest).toHaveBeenCalledWith("/organizations/org_1");
  });

  it("errors clearly when the member has no key access yet", async () => {
    const session = await makeSession();
    apiRequest.mockResolvedValueOnce({ self: { wrappedOrgKey: null, status: "INVITED" } });
    const project = {
      id: "33333333-3333-4333-8333-333333333333",
      wrappedProjectKey: { iv: "x", ciphertext: "y" },
      organizationId: "org_2",
      organizationName: "Beta",
    } as unknown as ProjectDto;

    await expect(resolveProjectKey(project, session)).rejects.toThrow(/key access/i);
  });
});
