import { normalizeApiBaseUrl } from "./api-client";

describe("normalizeApiBaseUrl", () => {
  it("appends /api/v1 to a bare origin", () => {
    expect(normalizeApiBaseUrl("https://vault.example.com")).toBe("https://vault.example.com/api/v1");
  });

  it("assumes https:// when no scheme is given", () => {
    expect(normalizeApiBaseUrl("vault.example.com")).toBe("https://vault.example.com/api/v1");
  });

  it("keeps http:// for local development", () => {
    expect(normalizeApiBaseUrl("http://localhost:3000")).toBe("http://localhost:3000/api/v1");
  });

  it("trims trailing slashes", () => {
    expect(normalizeApiBaseUrl("https://vault.example.com/")).toBe("https://vault.example.com/api/v1");
  });

  it("leaves an already-versioned URL alone", () => {
    expect(normalizeApiBaseUrl("https://vault.example.com/api/v1")).toBe(
      "https://vault.example.com/api/v1",
    );
    expect(normalizeApiBaseUrl("https://vault.example.com/api/v2/")).toBe(
      "https://vault.example.com/api/v2",
    );
  });
});
