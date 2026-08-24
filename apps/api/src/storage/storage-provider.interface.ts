export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");

/**
 * Object storage abstraction. Implementations only ever see opaque keys
 * and opaque bytes (ciphertext) — the domain layer above this never needs
 * to change when the storage backend does.
 */
export interface StorageProvider {
  putObject(key: string, data: Buffer): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
}
