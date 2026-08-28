import { bytesToBase64, base64ToBytes, utf8ToBytes, bytesToUtf8 } from "./encoding";
import { aeadEncrypt, aeadDecrypt, DecryptionError } from "./aead";
import {
  provisionVault,
  unlockVault,
  rewrapMasterKey,
  createProjectKey,
  openProjectKey,
  encryptFileContent,
  decryptFileContent,
} from "./vault";
import { deriveKek } from "./kdf";
import { generateSalt } from "./random";

describe("encoding", () => {
  it("round-trips arbitrary byte lengths through base64", () => {
    for (const len of [0, 1, 2, 3, 4, 5, 16, 31, 32, 100]) {
      const bytes = new Uint8Array(len).map((_, i) => (i * 37) % 256);
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    }
  });

  it("round-trips utf8 text", () => {
    const text = "hello 👋 world — DATABASE_URL=postgres://u:p@h/db";
    expect(bytesToUtf8(utf8ToBytes(text))).toBe(text);
  });
});

describe("aeadEncrypt/aeadDecrypt", () => {
  it("decrypts what it encrypted", async () => {
    const key = new Uint8Array(32).fill(7);
    const plaintext = utf8ToBytes("API_KEY=super-secret-value");
    const { iv, ciphertext } = await aeadEncrypt(key, plaintext);
    const decrypted = await aeadDecrypt(key, iv, ciphertext);
    expect(bytesToUtf8(decrypted)).toBe("API_KEY=super-secret-value");
  });

  it("fails closed when the key is wrong", async () => {
    const key = new Uint8Array(32).fill(1);
    const wrongKey = new Uint8Array(32).fill(2);
    const { iv, ciphertext } = await aeadEncrypt(key, utf8ToBytes("secret"));
    await expect(aeadDecrypt(wrongKey, iv, ciphertext)).rejects.toThrow(DecryptionError);
  });

  it("fails closed when the ciphertext is tampered with", async () => {
    const key = new Uint8Array(32).fill(3);
    const { iv, ciphertext } = await aeadEncrypt(key, utf8ToBytes("secret"));
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;
    await expect(aeadDecrypt(key, iv, tampered)).rejects.toThrow(DecryptionError);
  });

  it("fails closed when AAD does not match", async () => {
    const key = new Uint8Array(32).fill(4);
    const { iv, ciphertext } = await aeadEncrypt(key, utf8ToBytes("secret"), utf8ToBytes("file:1"));
    await expect(aeadDecrypt(key, iv, ciphertext, utf8ToBytes("file:2"))).rejects.toThrow(
      DecryptionError,
    );
  });

  it("never reuses an IV across two calls", async () => {
    const key = new Uint8Array(32).fill(9);
    const a = await aeadEncrypt(key, utf8ToBytes("a"));
    const b = await aeadEncrypt(key, utf8ToBytes("a"));
    expect(bytesToBase64(a.iv)).not.toBe(bytesToBase64(b.iv));
  });
});

describe("kdf", () => {
  it("is deterministic for the same passphrase/salt/iterations", async () => {
    const salt = generateSalt();
    const a = await deriveKek("correct horse battery staple", salt, 10_000);
    const b = await deriveKek("correct horse battery staple", salt, 10_000);
    expect(bytesToBase64(a)).toBe(bytesToBase64(b));
  });

  it("produces different keys for different passphrases", async () => {
    const salt = generateSalt();
    const a = await deriveKek("passphrase-one", salt, 10_000);
    const b = await deriveKek("passphrase-two", salt, 10_000);
    expect(bytesToBase64(a)).not.toBe(bytesToBase64(b));
  });
});

describe("zero-knowledge vault envelope", () => {
  it("provisions a vault and unlocks it with the correct passphrase", async () => {
    const { keyMaterial, masterKey } = await provisionVault("my-vault-passphrase");
    const unlocked = await unlockVault("my-vault-passphrase", keyMaterial);
    expect(bytesToBase64(unlocked)).toBe(bytesToBase64(masterKey));
  });

  it("refuses to unlock with the wrong passphrase", async () => {
    const { keyMaterial } = await provisionVault("correct-passphrase");
    await expect(unlockVault("wrong-passphrase", keyMaterial)).rejects.toThrow(DecryptionError);
  });

  it("never stores plaintext key material — wrapped blob differs from raw master key", async () => {
    const { keyMaterial, masterKey } = await provisionVault("passphrase");
    expect(keyMaterial.wrappedMasterKey.ciphertext).not.toBe(bytesToBase64(masterKey));
  });

  it("supports passphrase rotation without losing access to the master key", async () => {
    const { masterKey } = await provisionVault("old-passphrase");
    const newMaterial = await rewrapMasterKey(masterKey, "new-passphrase");
    const unlocked = await unlockVault("new-passphrase", newMaterial);
    expect(bytesToBase64(unlocked)).toBe(bytesToBase64(masterKey));
    await expect(unlockVault("old-passphrase", newMaterial)).rejects.toThrow(DecryptionError);
  });

  it("wraps/unwraps a per-project data key under the master key", async () => {
    const { masterKey } = await provisionVault("passphrase");
    const { wrappedProjectKey, projectKey } = await createProjectKey(masterKey, "prj_123");
    const opened = await openProjectKey(masterKey, "prj_123", wrappedProjectKey);
    expect(bytesToBase64(opened)).toBe(bytesToBase64(projectKey));
  });

  it("binds a wrapped project key to its project id (cannot be replayed against another project)", async () => {
    const { masterKey } = await provisionVault("passphrase");
    const { wrappedProjectKey } = await createProjectKey(masterKey, "prj_123");
    await expect(openProjectKey(masterKey, "prj_OTHER", wrappedProjectKey)).rejects.toThrow(
      DecryptionError,
    );
  });

  it("encrypts and decrypts file contents byte-for-byte, preserving exact formatting", async () => {
    const { masterKey } = await provisionVault("passphrase");
    const { projectKey } = await createProjectKey(masterKey, "prj_123");
    const original =
      "# comment\nDATABASE_URL=\"postgres://user:pass@host:5432/db\"\nMULTILINE=\"line1\\nline2\"\n\nTRAILING_SPACE = value   \n";
    const payload = await encryptFileContent(projectKey, "file_v1", utf8ToBytes(original));
    const decrypted = await decryptFileContent(projectKey, "file_v1", payload);
    expect(bytesToUtf8(decrypted)).toBe(original);
  });

  it("binds file ciphertext to its file/version id (cannot be replayed onto another record)", async () => {
    const { masterKey } = await provisionVault("passphrase");
    const { projectKey } = await createProjectKey(masterKey, "prj_123");
    const payload = await encryptFileContent(projectKey, "file_v1", utf8ToBytes("secret=1"));
    await expect(decryptFileContent(projectKey, "file_v2", payload)).rejects.toThrow(
      DecryptionError,
    );
  });
});
