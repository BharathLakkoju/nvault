import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { StorageProvider } from "./storage-provider.interface";

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private client?: S3Client;
  private bucket?: string;

  constructor(private readonly config: ConfigService) {}

  // Lazily constructed: this provider is instantiated at boot regardless of
  // which STORAGE_PROVIDER is active, so it must not require S3 env vars
  // to be present unless it is actually used.
  private getClient(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      this.bucket = this.config.getOrThrow<string>("STORAGE_S3_BUCKET");
      this.client = new S3Client({
        region: this.config.get<string>("STORAGE_S3_REGION", "auto"),
        endpoint: this.config.get<string>("STORAGE_S3_ENDPOINT") || undefined,
        forcePathStyle: this.config.get<boolean>("STORAGE_S3_FORCE_PATH_STYLE", true),
        credentials:
          this.config.get<string>("STORAGE_S3_ACCESS_KEY_ID") &&
          this.config.get<string>("STORAGE_S3_SECRET_ACCESS_KEY")
            ? {
                accessKeyId: this.config.getOrThrow<string>("STORAGE_S3_ACCESS_KEY_ID"),
                secretAccessKey: this.config.getOrThrow<string>("STORAGE_S3_SECRET_ACCESS_KEY"),
              }
            : undefined,
      });
    }
    return { client: this.client, bucket: this.bucket };
  }

  async putObject(key: string, data: Buffer): Promise<void> {
    const { client, bucket } = this.getClient();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data }));
  }

  async getObject(key: string): Promise<Buffer> {
    const { client, bucket } = this.getClient();
    try {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) throw new NotFoundException("Object not found");
      return Buffer.from(bytes);
    } catch (err) {
      if (err instanceof NoSuchKey) throw new NotFoundException("Object not found");
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const { client, bucket } = this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
