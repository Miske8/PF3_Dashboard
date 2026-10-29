import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient : évite l'épuisement des connexions PostgreSQL
 * en développement (rechargement à chaud de Next.js).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
