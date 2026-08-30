import { DecryptionError } from "./aead";
import {
  InvalidEnrollmentSecret,
  createEnrollmentWrappedOrgKey,
  formatEnrollmentSecret,
  generateEnrollmentSecret,
  normalizeEnrollmentSecret,
  openOrgKeyWithEnrollmentSecret,
  parseEnrollmentSecret,
  wrapOrgKeyWithEnrollmentSecret,
} from "./org-enrollment";
import { bytesToBase64 } from "./encoding";

describe("enrollment secret encoding", () => {
  it("generates a 26-char (128-bit) secret, dash-grouped", () => {
    const s = generateEnrollmentSecret();
    expect(normalizeEnrollmentSecret(s)).toHaveLength(26);
    expect(s).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{2,4})+$/);
  });

  it("round-trips through parse", () => {
    const s = generateEnrollmentSecret();
    const bytes = parseEnrollmentSecret(s);
    expect(bytes).toHaveLength(16);
    // re-encoding the same bytes yields the same normalized string
    expect(parseEnrollmentSecret(formatEnrollmentSecret(s))).toEqual(bytes);
  });

  it("normalizes case, separators and Crockford aliases", () => {
    const s = generateEnrollmentSecret();
    const norm = normalizeEnrollmentSecret(s);
    const messy = norm.toLowerCase().replace(/(.{3})/g, "$1 ");
    expect(normalizeEnrollmentSecret(messy)).toBe(norm);
    expect(normalizeEnrollmentSecret("O0oIiLl")).toBe("0001111");
  });

  it("rejects malformed input", () => {
    expect(() => parseEnrollmentSecret("too-short")).toThrow(InvalidEnrollmentSecret);
    expect(() => parseEnrollmentSecret("U".repeat(26))).toThrow(InvalidEnrollmentSecret);
  });
});

describe("enrollment key wrapping", () => {
  it("wraps and unwraps an Org Key with the correct secret", async () => {
    const secret = generateEnrollmentSecret();
    const { orgKey, wrap } = await createEnrollmentWrappedOrgKey(secret);
    const recovered = await openOrgKeyWithEnrollmentSecret(secret, wrap);
    expect(bytesToBase64(recovered)).toBe(bytesToBase64(orgKey));
  });

  it("fails closed on the wrong secret", async () => {
    const { wrap } = await createEnrollmentWrappedOrgKey(generateEnrollmentSecret());
    await expect(
      openOrgKeyWithEnrollmentSecret(generateEnrollmentSecret(), wrap),
    ).rejects.toThrow(DecryptionError);
  });

  it("does not store the Org Key or the secret in the clear", async () => {
    const secret = generateEnrollmentSecret();
    const { orgKey, wrap } = await createEnrollmentWrappedOrgKey(secret);
    expect(wrap.wrappedOrgKey.ciphertext).not.toContain(bytesToBase64(orgKey));
    expect(JSON.stringify(wrap)).not.toContain(normalizeEnrollmentSecret(secret));
  });

  it("re-wraps an existing Org Key under a fresh secret (rotation)", async () => {
    const secret1 = generateEnrollmentSecret();
    const { orgKey, wrap: wrap1 } = await createEnrollmentWrappedOrgKey(secret1);
    const secret2 = generateEnrollmentSecret();
    const wrap2 = await wrapOrgKeyWithEnrollmentSecret(orgKey, secret2);

    expect(bytesToBase64(await openOrgKeyWithEnrollmentSecret(secret2, wrap2))).toBe(
      bytesToBase64(orgKey),
    );
    await expect(openOrgKeyWithEnrollmentSecret(secret2, wrap1)).rejects.toThrow(DecryptionError);
  });
});
