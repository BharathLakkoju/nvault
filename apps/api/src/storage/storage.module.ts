import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { STORAGE_PROVIDER } from "./storage-provider.interface";
import { DatabaseStorageProvider } from "./database-storage.provider";
import { LocalFsStorageProvider } from "./local-fs-storage.provider";
import { S3StorageProvider } from "./s3-storage.provider";

@Module({
  imports: [ConfigModule],
  providers: [
    DatabaseStorageProvider,
    LocalFsStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, DatabaseStorageProvider, LocalFsStorageProvider, S3StorageProvider],
      useFactory: (
        config: ConfigService,
        database: DatabaseStorageProvider,
        local: LocalFsStorageProvider,
        s3: S3StorageProvider,
      ) => {
        const provider = config.get<string>("STORAGE_PROVIDER", "local");
        if (provider === "database") return database;
        if (provider === "s3") return s3;
        return local;
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
