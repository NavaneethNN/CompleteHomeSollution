import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event?.includes("test") === true ||
    process.argv.some((a) => a.includes("--test"))
  );
}

/**
 * Robust environment variable reader with .env fallback.
 */
let cachedEnvFile: Record<string, string> | null = null;
let lastEnvReadTime = 0;

function readEnvFromDisk(): Record<string, string> {
  const now = Date.now();
  if (cachedEnvFile && now - lastEnvReadTime < 5000) {
    return cachedEnvFile;
  }
  const result: Record<string, string> = {};
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const file = fs.readFileSync(envPath, "utf-8");
      for (const line of file.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const eqIdx = trimmed.indexOf("=");
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        result[key] = val;
      }
    }
  } catch {
    // ignore
  }
  cachedEnvFile = result;
  lastEnvReadTime = now;
  return result;
}

function getRedisEnv(key: string): string | undefined {
  if (process.env[key] !== undefined) {
    const val = process.env[key]?.trim();
    if (val) return val;
    if (process.env[key] === "") return undefined;
  }
  const disk = readEnvFromDisk();
  return disk[key]?.trim() || undefined;
}

let redisClient: Redis | null | undefined;

/**
 * Returns a configured Upstash Redis client with a fail-fast timeout (2000ms)
 * to ensure that Redis latency NEVER blocks or slows down page rendering.
 */
export function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = getRedisEnv("UPSTASH_REDIS_REST_URL");
  const token = getRedisEnv("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token || !url.startsWith("https://")) {
    redisClient = null;
    return null;
  }

  try {
    redisClient = new Redis({
      url,
      token,
      retry: {
        retries: 1,
        backoff: () => 50,
      },
    });
  } catch (err) {
    console.warn("[Redis] Failed to initialize Upstash client:", err);
    redisClient = null;
  }

  return redisClient;
}

/**
 * Backward-compatible proxy export so any legacy `redis.get(...)` calls continue to work safely.
 */
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedis();
    if (!client) {
      return async () => null;
    }
    const val = (client as any)[prop];
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  },
});

/* ─── Cache Keys & TTLs ────────────────────────────────────────────── */

export const CACHE_KEYS = {
  cart: (userId: string) => `cart:${userId}`,
  session: (sessionId: string) => `session:${sessionId}`,
  product: (slug: string) => `product:${slug}`,
  categoryProducts: (slug: string) => `category:products:${slug}`,
  productsAll: "products:all",
  categories: "categories:all",
  homeTrending: "home:trending:products",
  promotions: "promotions:active",
  searchSuggest: (q: string) => `search:suggest:${q.trim().toLowerCase()}`,
  rateLimit: (identifier: string) => `rate_limit:${identifier}`,
} as const;

export const CACHE_TTL = {
  cart: 60 * 60 * 24 * 7,        // 7 days
  session: 60 * 60 * 24 * 30,    // 30 days
  product: 60 * 30,              // 30 minutes
  categoryProducts: 60 * 30,     // 30 minutes
  productsAll: 60 * 30,          // 30 minutes
  categories: 60 * 60,           // 1 hour
  homeTrending: 60 * 15,         // 15 minutes
  promotions: 60 * 15,           // 15 minutes
  searchSuggest: 60 * 10,        // 10 minutes
} as const;

/* ─── Multi-Tier L1 (In-Memory) + L2 (Upstash Redis) Caching ────────── */

interface MemoryCacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Bounded in-memory L1 cache to avoid round-trips for high-frequency queries
const l1Cache = new Map<string, MemoryCacheEntry<any>>();
const MAX_L1_ENTRIES = 500;

function cleanL1Cache() {
  const now = Date.now();
  for (const [key, entry] of l1Cache.entries()) {
    if (entry.expiresAt <= now) {
      l1Cache.delete(key);
    }
  }
  if (l1Cache.size > MAX_L1_ENTRIES) {
    const oldestKeys = Array.from(l1Cache.keys()).slice(0, 100);
    for (const k of oldestKeys) l1Cache.delete(k);
  }
}

/**
 * Fetch a value from Redis with automatic JSON deserialization and fail-safe fallback.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (isTestEnvironment()) return null;

  // 1. Check L1 memory cache (0ms lookup)
  const l1 = l1Cache.get(key);
  if (l1 && l1.expiresAt > Date.now()) {
    return l1.data as T;
  }

  // 2. Check L2 Upstash Redis
  const client = getRedis();
  if (!client) return null;

  try {
    const raw = await Promise.race([
      client.get<T>(key),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Redis get timeout")), 1500)
      ),
    ]);

    if (raw !== null && raw !== undefined) {
      // Store in L1 for 30 seconds
      l1Cache.set(key, { data: raw, expiresAt: Date.now() + 30_000 });
      return raw;
    }
  } catch (err) {
    console.warn(`[Redis] cacheGet error for key "${key}":`, (err as any)?.message || err);
  }

  return null;
}

/**
 * Store a value in Upstash Redis and L1 memory cache with TTL in seconds.
 */
export async function cacheSet<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  if (isTestEnvironment()) return;

  // Store in L1 memory (up to 60s or ttlSeconds)
  const l1Ttl = Math.min(ttlSeconds, 60);
  l1Cache.set(key, { data, expiresAt: Date.now() + l1Ttl * 1000 });
  if (l1Cache.size > MAX_L1_ENTRIES) cleanL1Cache();

  // Store in Upstash Redis
  const client = getRedis();
  if (!client) return;

  try {
    await Promise.race([
      client.set(key, data, { ex: ttlSeconds }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Redis set timeout")), 1500)
      ),
    ]);
  } catch (err) {
    console.warn(`[Redis] cacheSet error for key "${key}":`, (err as any)?.message || err);
  }
}

/**
 * Invalidate a key or list of keys across L1 and L2 caches.
 */
export async function cacheDel(keys: string | string[]): Promise<void> {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const k of keyList) {
    l1Cache.delete(k);
  }

  const client = getRedis();
  if (!client || keyList.length === 0) return;

  try {
    await Promise.race([
      client.del(...keyList),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error("Redis del timeout")), 1500)
      ),
    ]);
  } catch (err) {
    console.warn("[Redis] cacheDel error:", (err as any)?.message || err);
  }
}

/**
 * Cache-aside fetcher with multi-tier caching and automatic fallback.
 * Checks L1 memory & L2 Redis. If missed, runs `fetcher()`, updates cache, and returns data.
 * If Redis is unavailable or times out, it seamlessly executes `fetcher()` without error.
 */
export async function cacheFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (isTestEnvironment()) {
    return await fetcher();
  }

  const cached = await cacheGet<T>(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  const data = await fetcher();

  if (data !== null && data !== undefined) {
    // Non-blocking asynchronous set so caller is never delayed
    cacheSet(key, data, ttlSeconds).catch(() => {});
  }

  return data;
}
