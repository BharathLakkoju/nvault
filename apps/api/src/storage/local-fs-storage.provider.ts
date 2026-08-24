import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { StorageProvider } from "./storage-provider.interface";

@Injectable()
export class LocalFsStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>("STORAGE_LOCAL_ROOT", "./data/blobs"));
  }

  async putObject(key: string, data: Buffer): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async getObject(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKey(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new NotFoundException("Object not found");
      }
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  /**
   * `key` is always generated server-side from opaque cuids (see
   * FilesService) — never from user input — but resolved paths are still
   * verified to stay within the storage root as defense in depth.
   */
  private resolveKey(key: string): string {
    const path = resolve(join(this.root, key));
    if (path !== this.root && !path.startsWith(this.root + sep)) {
      throw new Error(`Refusing to access storage path outside root: ${key}`);
    }
    return path;
  }
}
