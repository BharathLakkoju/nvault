"use client";

import { create } from "zustand";
import * as vaultCrypto from "@/lib/crypto";
import type { UserKeyPairMaterial, VaultKeyMaterial } from "@/lib/crypto";
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
  keyPairMaterial: UserKeyPairMaterial | null;
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
  keyPairMaterial: UserKeyPairMaterial | null;
  /**
   * The unwrapped vault master key. Held ONLY in memory for the lifetime of
   * this tab — never written to localStorage/sessionStorage/cookies. A page
   * reload always returns to a locked vault, by design.
   */
  masterKey: Uint8Array | null;
  /**
   * The unwrapped RSA private key (PKCS#8 bytes), recovered on vault unlock.
   * Same in-memory-only lifetime as `masterKey`. Used to open Organization
   * Keys addressed to this user.
   */
  privateKey: Uint8Array | null;

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
  keyPairMaterial: null,
  masterKey: null,
  privateKey: null,

  setSession(result) {
    set({
      status: "authenticated",
      accessToken: result.accessToken,
      user: result.user,
      vaultKeyMaterial: result.vaultKeyMaterial,
      keyPairMaterial: result.keyPairMaterial ?? null,
    });
  },

  clearSession() {
    set({
      status: "unauthenticated",
      accessToken: null,
      user: null,
      vaultKeyMaterial: null,
      keyPairMaterial: null,
      masterKey: null,
      privateKey: null,
    });
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

    // Recover (or, for pre-keypair accounts, provision) the asymmetric
    // keypair used for organization key sharing. A wrong passphrase throws
    // above before we get here, so this only runs on a successful unlock.
    let keyPairMaterial = get().keyPairMaterial;
    let privateKey: Uint8Array;
    if (keyPairMaterial) {
      privateKey = await vaultCrypto.unwrapUserPrivateKey(masterKey, keyPairMaterial);
    } else {
      const provisioned = await vaultCrypto.provisionUserKeyPair(masterKey);
      try {
        const res = await apiRequest<{ keyPairMaterial: UserKeyPairMaterial | null }>(
          "/auth/vault/keypair",
          { method: "POST", body: provisioned.material },
        );
        keyPairMaterial = res.keyPairMaterial ?? provisioned.material;
      } catch (err) {
        // 409 => another tab/device already provisioned one. Fetch it and
        // unwrap that instead of our just-generated pair.
        if (err instanceof ApiError && err.status === 409) {
          const res = await apiRequest<{ keyPairMaterial: UserKeyPairMaterial | null }>(
            "/auth/vault/keypair",
          );
          keyPairMaterial = res.keyPairMaterial;
        } else {
          throw err;
        }
      }
      privateKey = keyPairMaterial
        ? await vaultCrypto.unwrapUserPrivateKey(masterKey, keyPairMaterial)
        : provisioned.privateKey;
    }

    // The wrapped private key is authenticated under the master key, so it
    // cannot be forged by the server — but `publicKey` is served in the
    // clear. Verify they are a pair, so a server that swapped the public key
    // (to intercept an Org Key wrapped "to us" at rotation) is caught here
    // rather than silently trusted.
    if (keyPairMaterial) {
      await vaultCrypto.assertKeyPairConsistent(privateKey, keyPairMaterial.publicKey);
    }

    set({ masterKey, privateKey, keyPairMaterial });
  },

  lockVault() {
    set({ masterKey: null, privateKey: null });
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
