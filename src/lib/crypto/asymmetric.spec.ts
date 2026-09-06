import { bytesToBase64, base64ToBytes } from "./encoding";
import { DecryptionError } from "./aead";
import { provisionVault } from "./vault";
import {
  provisionUserKeyPair,
  unwrapUserPrivateKey,
  rewrapUserPrivateKey,
  wrapToPublicKey,
  unwrapFromPrivateKey,
} from "./asymmetric";

describe("user keypair", () => {
  it("provisions a keypair and unwraps the private key with the master key", async () => {
    const { masterKey } = await provisionVault("passphrase");
    const { material, privateKey } = await provisionUserKeyPair(masterKey);
    const recovered = await unwrapUserPrivateKey(masterKey, material);
    expect(bytesToBase64(recovered)).toBe(bytesToBase64(privateKey));
  });

  it("never persists the private key in the clear", async () => {
    const { masterKey } = await provisionVault("passphrase");
    const { material, privateKey } = await provisionUserKeyPair(masterKey);
    expect(material.wrappedPrivateKey.ciphertext).not.toBe(bytesToBase64(privateKey));
    expect(material.publicKey).not.toBe(bytesToBase64(privateKey));
  });

  it("refuses to unwrap the private key with the wrong master key", async () => {
    const { masterKey } = await provisionVault("passphrase");
    const { masterKey: otherKey } = await provisionVault("other-passphrase");
    const { material } = await provisionUserKeyPair(masterKey);
    await expect(unwrapUserPrivateKey(otherKey, material)).rejects.toThrow(DecryptionError);
  });

  it("survives master-key rotation via rewrapUserPrivateKey", async () => {
    const { masterKey } = await provisionVault("passphrase");
    const { masterKey: newMasterKey } = await provisionVault("new-passphrase");
    const { material, privateKey } = await provisionUserKeyPair(masterKey);
    const rewrapped = await rewrapUserPrivateKey(newMasterKey, privateKey);
    const recovered = await unwrapUserPrivateKey(newMasterKey, { wrappedPrivateKey: rewrapped });
    expect(bytesToBase64(recovered)).toBe(bytesToBase64(privateKey));
  });
});

describe("wrapToPublicKey / unwrapFromPrivateKey", () => {
  it("round-trips a 32-byte key between two parties", async () => {
    const { masterKey: aliceMaster } = await provisionVault("alice");
    const { masterKey: bobMaster } = await provisionVault("bob");
    const alice = await provisionUserKeyPair(aliceMaster);
    const bob = await provisionUserKeyPair(bobMaster);

    // Alice wraps an org key to Bob's public key.
    const orgKey = new Uint8Array(32).map((_, i) => (i * 11) % 256);
    const wrapped = await wrapToPublicKey(bob.material.publicKey, orgKey);

    // Only Bob's private key recovers it.
    const bobPrivate = await unwrapUserPrivateKey(bobMaster, bob.material);
    const recovered = await unwrapFromPrivateKey(bobPrivate, wrapped);
    expect(bytesToBase64(recovered)).toBe(bytesToBase64(orgKey));

    // Alice's private key cannot.
    const alicePrivate = await unwrapUserPrivateKey(aliceMaster, alice.material);
    await expect(unwrapFromPrivateKey(alicePrivate, wrapped)).rejects.toThrow(DecryptionError);
  });

  it("fails closed on a tampered ciphertext", async () => {
    const { masterKey } = await provisionVault("passphrase");
    const kp = await provisionUserKeyPair(masterKey);
    const secret = new Uint8Array(32).fill(5);
    const wrapped = await wrapToPublicKey(kp.material.publicKey, secret);
    const bytes = base64ToBytes(wrapped);
    bytes[Math.floor(bytes.length / 2)] ^= 0xff;
    const tampered = bytesToBase64(bytes);
    const priv = await unwrapUserPrivateKey(masterKey, kp.material);
    await expect(unwrapFromPrivateKey(priv, tampered)).rejects.toThrow(DecryptionError);
  });
});
