import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isCouriersPleaseTestMode } from "@/lib/couriersplease";
import { syncOrderWithCouriersPlease } from "@/lib/couriersplease-sync";
import { isSimulationTrackingCode } from "@/lib/tracking-url";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: {
        // S-5: Only expose required product fields — not the full product object
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: true,
                sku: true,
                basePrice: true,
              },
            },
            productVariant: {
              select: {
                id: true,
                sku: true,
                price: true,
                images: { select: { url: true, displayOrder: true } },
                values: {
                  include: {
                    variantValue: {
                      select: {
                        value: true,
                        variantAttribute: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        address: true,
      },
    });

    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (session.user.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Throttled live sync for active Couriers Please consignments so customer view catches
    // out-for-delivery/delivered updates promptly even if webhooks are delayed.
    if (
      ["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status) &&
      order.trackingNumber &&
      order.carrier?.toLowerCase().includes("couriers please") &&
      !isSimulationTrackingCode(order.trackingNumber) &&
      !isCouriersPleaseTestMode()
    ) {
      try {
        const checkGate = await consumeRateLimit("cp-live-order-sync", order.id, 1, 120);
        if (checkGate.allowed) {
          const outcome = await Promise.race([
            syncOrderWithCouriersPlease(order),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
          ]);
          if (outcome?.updated) {
            order.status = outcome.orderStatus as typeof order.status;
            order.updatedAt = new Date();
          }
        }
      } catch (syncErr) {
        console.warn("[GET /api/orders/[id]] Live courier sync warning:", syncErr);
      }
    }

    return NextResponse.json({ data: order }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("[GET /api/orders/[id]]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
