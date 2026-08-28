"use client";

import { create } from "zustand";
import * as vaultCrypto from "@/lib/crypto";
import type { VaultKeyMaterial } from "@/lib/crypto";
import { apiRequest, ApiError } from "./api-client";

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

interface AuthApiResult {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  user: PublicUser;
  vaultKeyMaterial: VaultKeyMaterial;
}

type BootStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * De-dupes concurrent refresh calls. The refresh token rotates on every use,
 * so two overlapping calls (React 18 Strict Mode double-invoking bootstrap,
 * or several 401s retrying at once) would race: the first rotates the token,
 * the rest present the now-stale one and get logged out. All callers share
 * the one in-flight promise instead.
 */
let inFlightRefresh: Promise<boolean> | null = null;

interface AuthState {
  status: BootStatus;
  accessToken: string | null;
  user: PublicUser | null;
  vaultKeyMaterial: VaultKeyMaterial | null;
  /**
   * The unwrapped vault master key. Held ONLY in memory for the lifetime of
   * this tab — never written to localStorage/sessionStorage/cookies. A page
   * reload always returns to a locked vault, by design.
   */
  masterKey: Uint8Array | null;

  bootstrap: () => Promise<void>;
  tryRefresh: () => Promise<boolean>;
  setSession: (result: AuthApiResult) => void;
  clearSession: () => void;
  unlockVault: (passphrase: string) => Promise<void>;
  lockVault: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  accessToken: null,
  user: null,
  vaultKeyMaterial: null,
  masterKey: null,

  setSession(result) {
    set({
      status: "authenticated",
      accessToken: result.accessToken,
      user: result.user,
      vaultKeyMaterial: result.vaultKeyMaterial,
    });
  },

  clearSession() {
    set({ status: "unauthenticated", accessToken: null, user: null, vaultKeyMaterial: null, masterKey: null });
  },

  async tryRefresh() {
    if (inFlightRefresh) return inFlightRefresh;
    inFlightRefresh = (async () => {
      try {
        const result = await apiRequest<AuthApiResult & { refreshToken?: string }>("/auth/refresh", {
          method: "POST",
          skipAuthRetry: true,
        });
        get().setSession(result);
        return true;
      } catch {
        return false;
      } finally {
        inFlightRefresh = null;
      }
    })();
    return inFlightRefresh;
  },

  async bootstrap() {
    const ok = await get().tryRefresh();
    if (!ok) {
      set({ status: "unauthenticated" });
    }
  },

  async unlockVault(passphrase: string) {
    const material = get().vaultKeyMaterial;
    if (!material) throw new Error("No vault key material loaded yet");
    const masterKey = await vaultCrypto.unlockVault(passphrase, material);
    set({ masterKey });
  },

  lockVault() {
    set({ masterKey: null });
  },

  async logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    } finally {
      get().clearSession();
    }
  },
}));
