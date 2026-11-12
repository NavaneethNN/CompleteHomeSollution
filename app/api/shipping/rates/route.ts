import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Legacy shipping rates endpoint is retired. Use /api/shipping/couriersplease." },
    { status: 410 }
  );
}
