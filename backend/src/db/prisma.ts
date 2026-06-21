import { PrismaClient } from "@prisma/client";

// A single PrismaClient per process. `tsx watch` reloads modules in dev, so
// stash the instance on globalThis to avoid leaking connections across reloads.
// `new PrismaClient()` is lazy: no DB connection is opened until the first query.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
