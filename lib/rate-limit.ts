import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { Redis } from "@upstash/redis";

export interface RateLimitResult { allowed: boolean; remaining: number; retryAfter: number }
interface LocalEntry { count: number; expiresAt: number }
const localStore = new Map<string, LocalEntry>();
let redis: Redis | null | undefined;

function redisClient(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function keyFor(action: string, identifier: string): string {
  const digest = createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex");
  return `rate-limit:${action}:${digest}`;
}

/** Deployment must strip untrusted forwarding headers; malformed addresses are never accepted. */
export function getClientIp(headers: Headers): string {
  const candidates = [headers.get("cf-connecting-ip"), headers.get("x-real-ip"), headers.get("x-forwarded-for")?.split(",")[0]];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && isIP(value)) return value;
  }
  return "unknown";
}

export async function consumeRateLimit(action: string, identifier: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const key = keyFor(action, identifier);
  const client = redisClient();
  if (client) {
    try {
      const count = Number(await client.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
        [key], [windowSeconds],
      ));
      const ttl = Math.max(1, await client.ttl(key));
      return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfter: ttl };
    } catch (error) {
      console.error("[rate-limit] shared limiter unavailable", { action, error });
      if (process.env.NODE_ENV === "production") return { allowed: false, remaining: 0, retryAfter: 60 };
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[rate-limit] Redis configuration missing", { action });
    return { allowed: false, remaining: 0, retryAfter: 60 };
  }

  const now = Date.now();
  const current = localStore.get(key);
  const entry = !current || current.expiresAt <= now ? { count: 0, expiresAt: now + windowSeconds * 1000 } : current;
  entry.count += 1;
  localStore.set(key, entry);
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), retryAfter: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)) };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(result.retryAfter) } });
}

export function clearRateLimitsForTests(): void { localStore.clear(); }
