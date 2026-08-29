import * as vaultCrypto from "@core/crypto";
import type { UserKeyPairMaterial, VaultKeyMaterial } from "@core/crypto";
import { apiRequest } from "./api-client";
import { provisionKeyPair, unwrapPrivateKey } from "./vault-client";
import { promptHidden } from "./prompt";
import { envConfig } from "./env";

interface MeResponse {
  user: { id: string; email: string; name: string | null };
  vaultKeyMaterial: VaultKeyMaterial;
  keyPairMaterial: UserKeyPairMaterial | null;
}

export interface VaultSession {
  masterKey: Uint8Array;
  /** RSA private key (PKCS#8) — needed to open Organization Keys. */
  privateKey: Uint8Array;
  email: string;
}

/**
 * Prompts for the vault passphrase and derives the master key for this
 * command invocation only. Nothing is cached to disk or across processes —
 * every command that needs to encrypt/decrypt asks again. That's a
 * deliberate zero-knowledge tradeoff: convenience never wins over never
 * persisting key material.
 *
 * Also recovers (or, for accounts that have only ever used the CLI,
 * provisions) the RSA keypair used for organization key sharing.
 *
 * `NVAULT_PASSPHRASE` is honoured for non-interactive/CI use. Prefer
 * feeding it from a secret store, never a literal in a script or CI YAML.
 */
export async function unlockVaultForThisCommand(): Promise<VaultSession> {
  const me = await apiRequest<MeResponse>("/auth/me");
  const passphrase = envConfig.passphrase() ?? (await promptHidden("Vault passphrase: "));
  if (!passphrase) throw new Error("A vault passphrase is required.");

  let masterKey: Uint8Array;
  try {
    masterKey = await vaultCrypto.unlockVault(passphrase, me.vaultKeyMaterial);
  } catch (err) {
    if (err instanceof vaultCrypto.DecryptionError) {
      throw new Error("Incorrect vault passphrase.");
    }
    throw err;
  }

  let keyPairMaterial = me.keyPairMaterial;
  let privateKey: Uint8Array;
  if (keyPairMaterial) {
    privateKey = await unwrapPrivateKey(masterKey, keyPairMaterial);
  } else {
    const provisioned = await provisionKeyPair(masterKey);
    try {
      const res = await apiRequest<{ keyPairMaterial: UserKeyPairMaterial | null }>(
        "/auth/vault/keypair",
        { method: "POST", body: provisioned.material },
      );
      keyPairMaterial = res.keyPairMaterial ?? provisioned.material;
      privateKey = await unwrapPrivateKey(masterKey, keyPairMaterial);
    } catch {
      // Another client provisioned one first — fetch and use that.
      const res = await apiRequest<{ keyPairMaterial: UserKeyPairMaterial | null }>(
        "/auth/vault/keypair",
      );
      if (!res.keyPairMaterial) throw new Error("Could not set up your encryption keypair.");
      privateKey = await unwrapPrivateKey(masterKey, res.keyPairMaterial);
    }
  }

  return { masterKey, privateKey, email: me.user.email };
}
