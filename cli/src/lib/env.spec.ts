describe("envConfig", () => {
  let mod: typeof import("./env");
  const keys = ["NVAULT_TOKEN", "ENVVAULT_TOKEN", "NVAULT_API_URL", "ENVVAULT_API_URL"];

  beforeEach(() => {
    for (const k of keys) delete process.env[k];
    jest.resetModules();
    mod = require("./env");
  });

  afterEach(() => {
    for (const k of keys) delete process.env[k];
  });

  it("returns undefined when neither prefix is set", () => {
    expect(mod.envConfig.token()).toBeUndefined();
  });

  it("reads the canonical NVAULT_ prefix", () => {
    process.env.NVAULT_TOKEN = "evk_new";
    expect(mod.envConfig.token()).toBe("evk_new");
  });

  it("falls back to the legacy ENVVAULT_ prefix", () => {
    process.env.ENVVAULT_API_URL = "https://legacy.example.com";
    expect(mod.envConfig.apiUrl()).toBe("https://legacy.example.com");
  });

  it("prefers NVAULT_ over ENVVAULT_ when both are set", () => {
    process.env.NVAULT_TOKEN = "evk_new";
    process.env.ENVVAULT_TOKEN = "evk_old";
    expect(mod.envConfig.token()).toBe("evk_new");
  });
});
