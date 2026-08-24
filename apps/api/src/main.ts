import "reflect-metadata";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import express from "express";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(helmet());
  app.use(cookieParser());
  // Base64-encoded ciphertext bodies inflate ~33% over the plaintext size
  // cap (see MAX_FILE_SIZE_BYTES); kept in sync with api/index.ts's Vercel
  // serverless entry point, which additionally can't exceed ~4.5MB.
  app.use(express.json({ limit: "6mb" }));

  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  app.enableCors({ origin: webOrigin, credentials: true });

  app.setGlobalPrefix("api/v1");

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`EnvVault API listening on :${port}`);
}

bootstrap();
