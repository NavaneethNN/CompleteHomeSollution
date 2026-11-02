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

  const adapter = new PrismaNeon({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });

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

function getPrismaInstance(): PrismaClientInstance {
  const existing = globalForPrisma.prisma;
  // In development environments with hot module replacement / Turbopack,
  // ensure the cached client has newly generated schema models available.
  if (
    existing &&
    "manualDeliveryPostcode" in (existing as unknown as Record<string, unknown>) &&
    "packagingPreset" in (existing as unknown as Record<string, unknown>)
  ) {
    return existing;
  }

  if (existing) {
    (existing as unknown as { $disconnect?: () => Promise<void> }).$disconnect?.().catch(() => {});
  }

  const fresh = createPrismaClient();
  globalForPrisma.prisma = fresh;
  return fresh;
}

export const db: PrismaClientInstance = new Proxy({} as PrismaClientInstance, {
  get(_target, prop, receiver) {
    const client = getPrismaInstance();
    const val = Reflect.get(client, prop, receiver);
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  },
});
