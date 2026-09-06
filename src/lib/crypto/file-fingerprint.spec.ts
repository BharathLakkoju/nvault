import { fileFingerprintHex } from "./file-fingerprint";
import { generateDataKey } from "./random";

describe("fileFingerprintHex", () => {
  it("is deterministic for the same project key and plaintext", async () => {
    const projectKey = generateDataKey();
    const plaintext = new TextEncoder().encode("DATABASE_URL=postgres://example\n");
    const a = await fileFingerprintHex(projectKey, plaintext);
    const b = await fileFingerprintHex(projectKey, plaintext);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the project key changes", async () => {
    const plaintext = new TextEncoder().encode("SECRET=1\n");
    const a = await fileFingerprintHex(generateDataKey(), plaintext);
    const b = await fileFingerprintHex(generateDataKey(), plaintext);
    expect(a).not.toBe(b);
  });
});
