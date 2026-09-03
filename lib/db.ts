import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

function createPrismaClient() {
  // Use the direct (non-pooler) URL in development — the pooler hostname is
  // only reachable from Vercel/serverless environments, not from localhost.
  // In production the pooler URL is fine and preferred for connection reuse.
  const connectionString =
    process.env.NODE_ENV === "production"
      ? (process.env.DATABASE_URL ?? "")
      : (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "");

  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
