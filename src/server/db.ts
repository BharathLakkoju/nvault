import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * A single PrismaClient per warm serverless instance (and per HMR reload in
 * dev). Creating a new client per request would exhaust the database's
 * connection pool under serverless concurrency.
 *
 * Prisma 7 connects through a driver adapter rather than a schema `url`.
 * DATABASE_URL is the pooled connection string (PgBouncer / Neon pooler on
 * Vercel); `prisma migrate` uses the unpooled DIRECT_DATABASE_URL via
 * prisma.config.ts.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaAdapter?: PrismaPg;
};

const adapter =
  globalForPrisma.prismaAdapter ??
  new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaAdapter = adapter;
}
