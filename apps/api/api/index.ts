import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "node:http";
import express, { type Express } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "../src/app.module";

/**
 * Vercel serverless entry point. Everything here mirrors src/main.ts —
 * this file exists only because Vercel's Node runtime needs a request
 * handler function rather than a long-running `app.listen()` process.
 * The Nest application itself, and every module/guard/service it wires
 * up, is identical to the one that boots via `node dist/main.js`
 * elsewhere (Docker, Railway, Render, a VPS).
 *
 * The app is built once per warm serverless instance and reused across
 * invocations (cold starts pay the boot cost; warm ones don't).
 */
let cachedApp: Promise<Express> | undefined;

async function bootstrap(): Promise<Express> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    bodyParser: false,
  });

  app.use(helmet());
  app.use(cookieParser());
  // Vercel's Node runtime enforces a hard ~4.5MB request body limit that
  // cannot be raised — MAX_FILE_SIZE_BYTES in @envvault/types is kept
  // comfortably under that after base64 inflation (see SECURITY.md).
  app.use(express.json({ limit: "4mb" }));

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });

  app.setGlobalPrefix("api/v1");
  await app.init();
  return expressApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!cachedApp) {
    cachedApp = bootstrap();
  }
  const expressApp = await cachedApp;
  expressApp(req, res);
}
