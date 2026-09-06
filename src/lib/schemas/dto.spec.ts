import { DotenvFilenameSchema, UploadFileVersionRequestSchema } from "./dto";

describe("DotenvFilenameSchema", () => {
  it("accepts .env and its documented variants", () => {
    for (const name of [".env", ".env.local", ".env.development", ".env.production", ".env.test", ".ENV.STAGING"]) {
      expect(DotenvFilenameSchema.safeParse(name).success).toBe(true);
    }
  });

  it("rejects non-dotenv config filenames", () => {
    for (const name of ["secrets.json", "config.yaml", "env", "app.env.example", "README.md"]) {
      expect(DotenvFilenameSchema.safeParse(name).success).toBe(false);
    }
  });

  it("still rejects unsafe filenames", () => {
    expect(DotenvFilenameSchema.safeParse("../../.env").success).toBe(false);
  });
});

describe("UploadFileVersionRequestSchema", () => {
  const base = {
    payload: { iv: "aXY=", ciphertext: "Y3Q=" },
    contentId: "00000000-0000-4000-8000-000000000000",
    plaintextSize: 12,
    plaintextFingerprint: "a".repeat(64),
  };

  it("accepts a dotenv-style upload", () => {
    expect(UploadFileVersionRequestSchema.safeParse({ ...base, filename: ".env.production" }).success).toBe(true);
  });

  it("rejects an upload whose filename is not a .env file", () => {
    expect(UploadFileVersionRequestSchema.safeParse({ ...base, filename: "secrets.json" }).success).toBe(false);
  });
});
