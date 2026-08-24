import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { STORAGE_PROVIDER } from "./storage-provider.interface";
import { LocalFsStorageProvider } from "./local-fs-storage.provider";
import { S3StorageProvider } from "./s3-storage.provider";

@Module({
  imports: [ConfigModule],
  providers: [
    LocalFsStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalFsStorageProvider, S3StorageProvider],
      useFactory: (config: ConfigService, local: LocalFsStorageProvider, s3: S3StorageProvider) =>
        config.get<string>("STORAGE_PROVIDER", "local") === "s3" ? s3 : local,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
