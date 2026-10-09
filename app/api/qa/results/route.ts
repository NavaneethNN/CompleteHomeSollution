import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { hasFreshAdminSession } from "@/lib/admin-auth";

const MAX_BODY_BYTES = 16 * 1024;
const resultSchema = z.object({
  testId: z.string().trim().min(1).max(120),
  suite: z.string().trim().min(1).max(120),
  status: z.enum(["PENDING", "PASSED", "FAILED"]),
  notes: z.string().max(5_000).optional(),
  comments: z.string().max(5_000).optional(),
}).strict();

export async function GET(req: NextRequest) {
  if (!(await hasFreshAdminSession())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const suite = req.nextUrl.searchParams.get("suite");
  if (suite && suite.length > 120) {
    return NextResponse.json({ error: "Invalid suite" }, { status: 400 });
  }
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
  if (!(await hasFreshAdminSession())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const declaredLength = Number(req.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    }

    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = resultSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid QA result" }, { status: 400 });
    }
    const { testId, suite, status, notes, comments } = parsed.data;

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
