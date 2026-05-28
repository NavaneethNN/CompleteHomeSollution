import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDomesticParcelRates } from "@/lib/auspost";

const schema = z.object({
  postcode: z.string().regex(/^\d{4}$/, "Must be a 4-digit postcode"),
  weightKg: z.number().positive().max(22).default(5),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postcode, weightKg } = schema.parse(body);

    const rates = await getDomesticParcelRates(postcode, weightKg);

    return NextResponse.json({ rates });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("[POST /api/shipping/auspost]", error);
    return NextResponse.json(
      { error: "Failed to fetch shipping rates" },
      { status: 500 }
    );
  }
}
