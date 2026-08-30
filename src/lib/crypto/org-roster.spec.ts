import { generateDataKey } from "./random";
import { provisionVault } from "./vault";
import { provisionUserKeyPair } from "./asymmetric";
import { DecryptionError } from "./aead";
import {
  decryptRoster,
  emptyRoster,
  encryptRoster,
  fingerprintPublicKey,
  verifyAgainstRoster,
  withEntry,
} from "./org-roster";

async function member() {
  const { masterKey } = await provisionVault("pw");
  const { material } = await provisionUserKeyPair(masterKey);
  return material.publicKey;
}

async function entryFor(publicKey: string) {
  return { fingerprint: await fingerprintPublicKey(publicKey), addedAt: new Date().toISOString() };
}

describe("org roster", () => {
  it("round-trips an encrypted roster under the Org Key", async () => {
    const orgKey = generateDataKey();
    const roster = withEntry(emptyRoster(), "u1", await entryFor(await member()));
    const blob = await encryptRoster(orgKey, roster);
    expect(await decryptRoster(orgKey, blob)).toEqual(roster);
  });

  it("fails closed under a different Org Key", async () => {
    const blob = await encryptRoster(generateDataKey(), emptyRoster());
    await expect(decryptRoster(generateDataKey(), blob)).rejects.toThrow(DecryptionError);
  });

  it("flags a substituted public key at rotation time", async () => {
    const honest = await member();
    const attacker = await member();
    const roster = withEntry(emptyRoster(), "u1", await entryFor(honest));

    const clean = await verifyAgainstRoster(roster, [{ userId: "u1", publicKey: honest }]);
    expect(clean.mismatched).toHaveLength(0);

    const tampered = await verifyAgainstRoster(roster, [{ userId: "u1", publicKey: attacker }]);
    expect(tampered.mismatched).toEqual([{ userId: "u1" }]);
  });

  it("reports members with no pin yet", async () => {
    const { unpinned } = await verifyAgainstRoster(emptyRoster(), [
      { userId: "u9", publicKey: await member() },
    ]);
    expect(unpinned).toEqual([{ userId: "u9" }]);
  });
});
