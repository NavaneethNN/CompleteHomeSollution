import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";

neonConfig.webSocketConstructor = WebSocket;

function createPrismaClient() {
  // Use the application's pooled connection in every environment. The direct
  // connection is primarily for migrations (configured in prisma.config.ts).
  const connectionString =
    process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "";

  const adapter = new PrismaNeon({ connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });

  return new PrismaClient({
    adapter,
    transactionOptions: { maxWait: 10000, timeout: 15000 },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = db;
