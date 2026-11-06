import { PrismaClient } from "@prisma/client";
import { ENV } from "../config/env.js";

// Keeps Prisma plus the raw pg pool (10) under Railway's Postgres connection limit.
const PRISMA_CONNECTION_LIMIT = 5;

export function withConnectionLimit(url: string, limit: number): string {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=${limit}`;
}

// A single PrismaClient per process. `tsx watch` reloads modules in dev, so
// stash the instance on globalThis to avoid leaking connections across reloads.
// `new PrismaClient()` is lazy: no DB connection is opened until the first query.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = 
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: withConnectionLimit(ENV.DATABASE_URL, PRISMA_CONNECTION_LIMIT) || undefined });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
