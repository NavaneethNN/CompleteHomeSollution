import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const suite = req.nextUrl.searchParams.get("suite");
  try {
    const where = suite ? { suite } : {};
    const results = await db.testResult.findMany({ where, orderBy: { testId: "asc" } });
    return NextResponse.json(results);
  } catch (err) {
    console.error("[GET /api/qa/results]", err);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { testId, suite, status, notes } = body as {
      testId: string;
      suite: string;
      status: "PENDING" | "PASSED" | "FAILED";
      notes?: string;
    };

    if (!testId || !suite || !status) {
      return NextResponse.json({ error: "testId, suite, and status are required" }, { status: 400 });
    }

    const result = await db.testResult.upsert({
      where: { testId },
      create: { testId, suite, status, notes: notes ?? null },
      update: { status, notes: notes ?? null },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[PUT /api/qa/results]", err);
    return NextResponse.json({ error: "Failed to save result" }, { status: 500 });
  }
}
