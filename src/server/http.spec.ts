import { ApiError, readJson } from "./http";
import { z } from "zod";

describe("readJson body limits", () => {
  const schema = z.object({ value: z.string() });

  function request(body: string, headers: Record<string, string> = {}): Request {
    const length = Buffer.byteLength(body, "utf8");
    return new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(length), ...headers },
      body,
    });
  }

  it("accepts bodies without Content-Length when they fit within the max", async () => {
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "ok" }),
    });
    await expect(readJson(req, schema, 64)).resolves.toEqual({ value: "ok" });
  });

  it("rejects bodies without Content-Length that exceed the max while streaming", async () => {
    const big = JSON.stringify({ value: "x".repeat(100) });
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: big,
    });
    await expect(readJson(req, schema, 32)).rejects.toMatchObject({ status: 413 });
  });

  it("rejects declared lengths above the max before reading the stream", async () => {
    const req = request(JSON.stringify({ value: "ok" }), { "content-length": "9999" });
    await expect(readJson(req, schema, 32)).rejects.toMatchObject({ status: 413 });
  });

  it("rejects streamed bodies that exceed the max", async () => {
    const big = JSON.stringify({ value: "x".repeat(100) });
    const req = request(big, { "content-length": String(Buffer.byteLength(big, "utf8")) });
    await expect(readJson(req, schema, 32)).rejects.toMatchObject({ status: 413 });
  });

  it("accepts a body within the declared limit", async () => {
    const req = request(JSON.stringify({ value: "ok" }));
    await expect(readJson(req, schema, 64)).resolves.toEqual({ value: "ok" });
  });

  it("rejects when the streamed body is shorter than Content-Length", async () => {
    const req = request(JSON.stringify({ value: "ok" }), { "content-length": "999" });
    await expect(readJson(req, schema, 1024)).rejects.toMatchObject({ status: 400 });
  });
});

describe("assertSameOriginCookieAuth", () => {
  const { assertSameOriginCookieAuth } = require("./http") as {
    assertSameOriginCookieAuth: (req: Request, allowedOrigin: string) => void;
  };
  const allowed = "https://app.example.com";

  it("allows matching Origin", () => {
    const req = new Request("http://localhost/api/v1/auth/refresh", {
      method: "POST",
      headers: { origin: allowed },
    });
    expect(() => assertSameOriginCookieAuth(req, allowed)).not.toThrow();
  });

  it("blocks mismatched Origin", () => {
    const req = new Request("http://localhost/api/v1/auth/refresh", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(() => assertSameOriginCookieAuth(req, allowed)).toThrow(ApiError);
  });

  it("blocks cross-site requests without Origin via Sec-Fetch-Site", () => {
    const req = new Request("http://localhost/api/v1/auth/refresh", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(() => assertSameOriginCookieAuth(req, allowed)).toThrow(ApiError);
  });
});
