import { NextRequest, NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { processDueEmailJobs } from "@/lib/email-outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await processDueEmailJobs();
  return NextResponse.json(result);
}
