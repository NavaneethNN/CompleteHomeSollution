import { NextResponse } from "next/server";
import { checkDatabaseReadiness } from "@/lib/database-readiness";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkDatabaseReadiness();
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("Shared rate limiter unavailable");
    await new Redis({ url, token, retry: false, signal: AbortSignal.timeout(5000) }).ping();
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
