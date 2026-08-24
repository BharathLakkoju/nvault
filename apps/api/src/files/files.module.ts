import { Module } from "@nestjs/common";
import { FilesService } from "./files.service";
import { FilesController } from "./files.controller";
import { ProjectsModule } from "../projects/projects.module";
import { StorageModule } from "../storage/storage.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [ProjectsModule, StorageModule, AuditModule],
  providers: [FilesService],
  controllers: [FilesController],
})
export class FilesModule {}
