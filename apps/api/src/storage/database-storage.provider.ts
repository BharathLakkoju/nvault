import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { StorageProvider } from "./storage-provider.interface";

@Injectable()
export class DatabaseStorageProvider implements StorageProvider {
  constructor(private readonly prisma: PrismaService) {}

  async putObject(key: string, data: Buffer): Promise<void> {
    await this.prisma.storageObject.upsert({
      where: { key },
      create: { key, data },
      update: { data },
    });
  }

  async getObject(key: string): Promise<Buffer> {
    const object = await this.prisma.storageObject.findUnique({ where: { key } });
    if (!object) throw new NotFoundException("Object not found");
    return Buffer.from(object.data);
  }

  async deleteObject(key: string): Promise<void> {
    await this.prisma.storageObject.deleteMany({ where: { key } });
  }
}
