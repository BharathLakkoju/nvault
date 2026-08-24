import * as vaultCrypto from "@envvault/crypto";
import type { VaultKeyMaterial } from "@envvault/crypto";
import { apiRequest } from "./api-client";
import { promptHidden } from "./prompt";

interface MeResponse {
  user: { id: string; email: string; name: string | null };
  vaultKeyMaterial: VaultKeyMaterial;
}

/**
 * Prompts for the vault passphrase and derives the master key for this
 * command invocation only. Nothing is cached to disk or across processes —
 * every command that needs to encrypt/decrypt asks again. That's a
 * deliberate zero-knowledge tradeoff: convenience never wins over never
 * persisting key material.
 */
export async function unlockVaultForThisCommand(): Promise<{ masterKey: Uint8Array; email: string }> {
  const me = await apiRequest<MeResponse>("/auth/me");
  const passphrase = await promptHidden("Vault passphrase: ");
  try {
    const masterKey = await vaultCrypto.unlockVault(passphrase, me.vaultKeyMaterial);
    return { masterKey, email: me.user.email };
  } catch (err) {
    if (err instanceof vaultCrypto.DecryptionError) {
      throw new Error("Incorrect vault passphrase.");
    }
    throw err;
  }
}
