import { NextRequest, NextResponse } from "next/server";
import { getShippingRates } from "@/lib/shippit";
import { z } from "zod";

const ratesSchema = z.object({
  postcode: z.string().length(4).regex(/^\d{4}$/),
  state: z.string(),
  suburb: z.string(),
  parcels: z.array(
    z.object({ qty: z.number().int().positive(), weight: z.number().positive() })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postcode, state, suburb, parcels } = ratesSchema.parse(body);

    const rates = await getShippingRates({
      dropoff_postcode: postcode,
      dropoff_state: state,
      dropoff_suburb: suburb,
      parcel_attributes: parcels,
    });

    return NextResponse.json({ data: rates });
  } catch (error) {
    console.error("[POST /api/shipping/rates]", error);
    return NextResponse.json({ error: "Failed to fetch shipping rates" }, { status: 500 });
  }
}
