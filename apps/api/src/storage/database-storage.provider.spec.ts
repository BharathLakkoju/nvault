import { NotFoundException } from "@nestjs/common";
import { DatabaseStorageProvider } from "./database-storage.provider";

describe("DatabaseStorageProvider", () => {
  function createProvider() {
    const storageObject = {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    };
    const provider = new DatabaseStorageProvider({ storageObject } as never);
    return { provider, storageObject };
  }

  it("upserts opaque bytes by storage key", async () => {
    const { provider, storageObject } = createProvider();
    const data = Buffer.from("ciphertext");

    await provider.putObject("projects/p/files/f/v1.bin", data);

    expect(storageObject.upsert).toHaveBeenCalledWith({
      where: { key: "projects/p/files/f/v1.bin" },
      create: { key: "projects/p/files/f/v1.bin", data },
      update: { data },
    });
  });

  it("returns bytes for an existing object", async () => {
    const { provider, storageObject } = createProvider();
    storageObject.findUnique.mockResolvedValue({ data: Buffer.from("ciphertext") });

    await expect(provider.getObject("projects/p/files/f/v1.bin")).resolves.toEqual(
      Buffer.from("ciphertext"),
    );
  });

  it("throws not found for a missing object", async () => {
    const { provider, storageObject } = createProvider();
    storageObject.findUnique.mockResolvedValue(null);

    await expect(provider.getObject("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("deletes by storage key without failing on missing rows", async () => {
    const { provider, storageObject } = createProvider();

    await provider.deleteObject("projects/p/files/f/v1.bin");

    expect(storageObject.deleteMany).toHaveBeenCalledWith({
      where: { key: "projects/p/files/f/v1.bin" },
    });
  });
});
