import { mkdtempSync, rmSync, writeFileSync, mkdirSync, statSync, readFileSync } from "node:fs";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";

describe("config-dir credentials", () => {
  let dir: string;
  let mod: typeof import("./config-dir");

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nvault-cfg-"));
    process.env.XDG_CONFIG_HOME = dir;
    process.env.APPDATA = dir;
    jest.resetModules();
    mod = require("./config-dir");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.APPDATA;
  });

  it("round-trips a token and does not persist any passphrase field", () => {
    mod.writeCredentials({
      apiBaseUrl: "https://vault.example.com/api/v1",
      token: "evk_secret",
      userEmail: "dev@example.com",
    });
    const back = mod.readCredentials();
    expect(back).toEqual({
      apiBaseUrl: "https://vault.example.com/api/v1",
      token: "evk_secret",
      userEmail: "dev@example.com",
    });
    const raw = readFileSync(join(mod.getConfigDir(), "credentials.json"), "utf8");
    expect(raw).not.toMatch(/passphrase|masterKey/i);
  });

  it("writes the credentials file owner-only (0600) on POSIX", () => {
    if (platform() === "win32") return;
    mod.writeCredentials({ apiBaseUrl: "https://x/api/v1", token: "evk_x", userEmail: "" });
    const mode = statSync(join(mod.getConfigDir(), "credentials.json")).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("reads credentials from the pre-rename `envvault` directory when the new one is empty", () => {
    const legacyDir = join(dir, "envvault");
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(
      join(legacyDir, "credentials.json"),
      JSON.stringify({ apiBaseUrl: "https://legacy.example.com/api/v1", token: "evk_legacy", userEmail: "old@example.com" }),
    );
    expect(mod.readCredentials()).toEqual({
      apiBaseUrl: "https://legacy.example.com/api/v1",
      token: "evk_legacy",
      userEmail: "old@example.com",
    });
  });

  it("prefers the new `nvault` directory over the legacy one", () => {
    const legacyDir = join(dir, "envvault");
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(
      join(legacyDir, "credentials.json"),
      JSON.stringify({ apiBaseUrl: "https://legacy/api/v1", token: "evk_legacy", userEmail: "" }),
    );
    mod.writeCredentials({ apiBaseUrl: "https://current/api/v1", token: "evk_current", userEmail: "" });
    expect(mod.readCredentials()?.token).toBe("evk_current");
  });

  it("returns null for a legacy/incomplete credentials file", () => {
    mkdirSync(mod.getConfigDir(), { recursive: true });
    writeFileSync(
      join(mod.getConfigDir(), "credentials.json"),
      JSON.stringify({ apiBaseUrl: "https://x/api/v1", accessToken: "old", refreshToken: "old" }),
    );
    expect(mod.readCredentials()).toBeNull();
  });
});
