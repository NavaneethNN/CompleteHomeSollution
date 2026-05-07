import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const CACHE_KEYS = {
  cart: (userId: string) => `cart:${userId}`,
  session: (sessionId: string) => `session:${sessionId}`,
  product: (slug: string) => `product:${slug}`,
  categories: "categories:all",
  rateLimit: (identifier: string) => `rate_limit:${identifier}`,
} as const;

export const CACHE_TTL = {
  cart: 60 * 60 * 24 * 7,        // 7 days
  session: 60 * 60 * 24 * 30,    // 30 days
  product: 60 * 60,               // 1 hour
  categories: 60 * 60 * 6,       // 6 hours
} as const;
