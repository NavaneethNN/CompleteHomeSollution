import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const suite = req.nextUrl.searchParams.get("suite");
  try {
    try {
      const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? "";
      const hostMatch = url.match(/@(.*?)\//);
      // eslint-disable-next-line no-console
      console.log("[api/qa/results][GET] suite=", suite ?? "(all)", "dbHost=", hostMatch ? hostMatch[1] : "(none)");
    } catch (e) {
      // ignore
    }
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
    try {
      const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? "";
      const hostMatch = url.match(/@(.*?)\//);
      // eslint-disable-next-line no-console
      console.log("[api/qa/results][PUT] dbHost=", hostMatch ? hostMatch[1] : "(none)");
    } catch (e) {
      // ignore
    }
    const body = await req.json();
    const { testId, suite, status, notes, comments } = body as {
      testId: string;
      suite: string;
      status: "PENDING" | "PASSED" | "FAILED";
      notes?: string;
      comments?: string;
    };

    if (!testId || !suite || !status) {
      return NextResponse.json({ error: "testId, suite, and status are required" }, { status: 400 });
    }

    const result = await db.testResult.upsert({
      where: { testId },
      create: { testId, suite, status, notes: notes ?? null, comments: comments ?? null },
      update: { status, notes: notes ?? null, comments: comments ?? null },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[PUT /api/qa/results]", err);
    return NextResponse.json({ error: "Failed to save result" }, { status: 500 });
  }
}
