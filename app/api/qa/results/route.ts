import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { testId, suite, status, notes } = await req.json();

    if (!testId || !suite || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await db.testResult.upsert({
      where: { testId },
      update: {
        status,
        notes: notes || "",
        updatedAt: new Date(),
      },
      create: {
        testId,
        suite,
        status,
        notes: notes || "",
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Failed to save test result:", error);
    return NextResponse.json(
      { error: "Failed to save test result" },
      { status: 500 }
    );
  }
}
