import * as vaultCrypto from "@core/crypto";
import type { VaultKeyMaterial } from "@core/crypto";
import { apiRequest } from "./api-client";
import { promptHidden } from "./prompt";
import { envConfig } from "./env";

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
 *
 * `NVAULT_PASSPHRASE` is honoured for non-interactive/CI use. Prefer
 * feeding it from a secret store, never a literal in a script or CI YAML.
 */
export async function unlockVaultForThisCommand(): Promise<{ masterKey: Uint8Array; email: string }> {
  const me = await apiRequest<MeResponse>("/auth/me");
  const passphrase = envConfig.passphrase() ?? (await promptHidden("Vault passphrase: "));
  if (!passphrase) throw new Error("A vault passphrase is required.");
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
