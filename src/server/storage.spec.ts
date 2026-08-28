/**
 * Unit tests for the server-side envelope-encryption storage layer.
 * `@/server/db` is mocked with an in-memory row store.
 */
process.env.STORAGE_ENCRYPTION_KEY ||= Buffer.alloc(32, 9).toString("base64");
process.env.DATABASE_URL ||= "postgresql://x";
process.env.DIRECT_DATABASE_URL ||= "postgresql://x";
process.env.JWT_SECRET ||= "x".repeat(40);

const rows = new Map<string, { key: string; data: Buffer }>();

jest.mock("@/server/db", () => ({
  db: {
    storageObject: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = rows.get(where.key);
        const row = existing
          ? { key: where.key, data: update.data }
          : { key: create.key, data: create.data };
        rows.set(where.key, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => rows.get(where.key) ?? null),
      deleteMany: jest.fn(async ({ where }: any) => {
        rows.delete(where.key);
        return { count: 1 };
      }),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { putObject, getObject, deleteObject } = require("./storage");

beforeEach(() => rows.clear());

describe("storage envelope encryption", () => {
  const key = "projects/p1/files/f1/v1.bin";
  const clientCiphertext = Buffer.from("this-is-already-client-encrypted-ciphertext");

  it("round-trips the client ciphertext unchanged", async () => {
    await putObject(key, clientCiphertext);
    const out = await getObject(key);
    expect(out.equals(clientCiphertext)).toBe(true);
  });

  it("stores something that is NOT the plaintext client ciphertext", async () => {
    await putObject(key, clientCiphertext);
    const stored = rows.get(key)!.data;
    expect(stored.equals(clientCiphertext)).toBe(false);
    expect(stored[0]).toBe(1); // format version prefix
    expect(stored.length).toBeGreaterThan(clientCiphertext.length + 1 + 12 + 16 - 1);
  });

  it("fails closed when the stored bytes are tampered with", async () => {
    await putObject(key, clientCiphertext);
    const stored = rows.get(key)!.data;
    stored[stored.length - 1] ^= 0xff; // flip a ciphertext bit
    await expect(getObject(key)).rejects.toThrow();
  });

  it("fails closed when the storage key (AAD) does not match", async () => {
    await putObject(key, clientCiphertext);
    const row = rows.get(key)!;
    rows.set("projects/p1/files/f1/v2.bin", { ...row, key: "projects/p1/files/f1/v2.bin" });
    await expect(getObject("projects/p1/files/f1/v2.bin")).rejects.toThrow();
  });

  it("throws not-found for a missing object", async () => {
    await expect(getObject("nope")).rejects.toThrow();
  });

  it("deletes without failing on missing rows", async () => {
    await expect(deleteObject("missing")).resolves.toBeUndefined();
  });
});
