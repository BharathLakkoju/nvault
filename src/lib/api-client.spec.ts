/// <reference types="jest" />

import { apiRequest } from "./api-client";
import { useAuthStore } from "./auth-store";

describe("apiRequest auth retry behavior", () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: "authenticated",
      accessToken: "test-access-token",
      user: {
        id: "user_123",
        email: "user@example.com",
        name: "Test User",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      vaultKeyMaterial: null,
      keyPairMaterial: null,
      masterKey: new Uint8Array([1, 2, 3]),
      privateKey: new Uint8Array([4, 5, 6]),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("locks the vault instead of clearing the authenticated session when refresh fails", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: {
        get: (name: string) => (name === "content-type" ? "application/json" : null),
      },
      json: async () => ({ message: "Unauthorized" }),
    } as Response);

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
      configurable: true,
    });

    const tryRefreshSpy = jest.spyOn(useAuthStore.getState(), "tryRefresh").mockResolvedValue(false);
    const lockSpy = jest.spyOn(useAuthStore.getState(), "lockVault");
    const clearSpy = jest.spyOn(useAuthStore.getState(), "clearSession");

    await expect(apiRequest("/protected-resource")).rejects.toMatchObject({ status: 401 });

    expect(tryRefreshSpy).toHaveBeenCalledTimes(1);
    expect(lockSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().masterKey).toBeNull();
    expect(useAuthStore.getState().privateKey).toBeNull();
  });

  it("keeps the account authenticated during bootstrap when refresh fails and only locks the vault", async () => {
    const bootstrap = useAuthStore.getState().bootstrap;
    const tryRefreshSpy = jest.spyOn(useAuthStore.getState(), "tryRefresh").mockResolvedValue(false);
    const lockSpy = jest.spyOn(useAuthStore.getState(), "lockVault");

    await bootstrap();

    expect(tryRefreshSpy).toHaveBeenCalled();
    expect(lockSpy).toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().masterKey).toBeNull();
    expect(useAuthStore.getState().privateKey).toBeNull();
  });

  it("schedules a refresh before the access token expires", () => {
    const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler) => {
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    useAuthStore.getState().setSession({
      accessToken: "fresh-token",
      accessTokenExpiresInSeconds: 60,
      user: {
        id: "user_123",
        email: "user@example.com",
        name: "Test User",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      vaultKeyMaterial: {} as any,
      keyPairMaterial: null,
    });

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);
  });
});
