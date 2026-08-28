import { PrismaClient } from "@prisma/client";

/**
 * A single PrismaClient per warm serverless instance (and per HMR reload in
 * dev). Creating a new client per request would exhaust the database's
 * connection pool under serverless concurrency.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
