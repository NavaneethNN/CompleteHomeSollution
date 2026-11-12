import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { syncActiveCouriersPleaseOrders } from "@/lib/couriersplease-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit")) || 25;

  return await Sentry.withMonitor(
    "sync-couriersplease",
    async () => {
      const result = await syncActiveCouriersPleaseOrders(limitParam);
      return NextResponse.json(result);
    },
    {
      schedule: {
        type: "crontab",
        value: "*/30 * * * *",
      },
      checkinMargin: 10,
      maxRuntime: 5,
    }
  );
}
