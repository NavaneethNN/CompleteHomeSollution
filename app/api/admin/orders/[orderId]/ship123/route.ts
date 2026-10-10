import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { buildParcelGroups, FreightRequiredError } from "@/lib/shipping-packages";
import {
  createShip123Order, getEligibleShip123Products, getShip123OrderDetail,
  ship123LabelUrl, ship123SenderFromEnv, Ship123Error,
} from "@/lib/ship123";

type Context = { params: Promise<{ orderId: string }> };
const bodySchema = z.object({
  productCode: z.string().regex(/^[A-Z0-9_-]{1,50}$/),
  knownOrderNo: z.string().trim().min(1).max(100).optional(),
});

async function orderForShipping(id: string) {
  return db.order.findUnique({ where: { id }, include: {
    address: true,
    user: { select: { email: true } },
    items: { include: { product: { select: { name: true, sku: true, weight: true, length: true, width: true, height: true } },
      productVariant: { select: { weight: true, length: true, width: true, height: true } } } },
  } });
}

function recipient(order: NonNullable<Awaited<ReturnType<typeof orderForShipping>>>) {
  return {
    name: order.address.name, line1: order.address.line1, line2: order.address.line2,
    suburb: order.address.suburb, state: order.address.state, postcode: order.address.postcode,
    phone: order.address.phone, email: order.user?.email ?? order.guestEmail,
  };
}

async function refreshDetail(id: string, orderNo: string, productCode: string, carrier: string, strictReference: boolean) {
  const detail = await getShip123OrderDetail(orderNo);
  if ((strictReference || detail.customerOrderNo) && detail.customerOrderNo !== id) {
    throw new Ship123Error("Ship123 order belongs to a different customer order");
  }
  if (detail.productCode && detail.productCode !== productCode) {
    throw new Ship123Error("Ship123 order uses a different shipping product");
  }
  const labelUrl = ship123LabelUrl(detail);
  const tracking = detail.trackNo || detail.waybillNo;
  await db.order.update({ where: { id }, data: {
    ship123OrderNo: orderNo, ship123CreateState: "CREATED", shippingServiceCode: productCode,
    ...(labelUrl ? { ship123LabelUrl: labelUrl } : {}),
    ...(tracking ? { trackingNumber: tracking, carrier } : {}),
  } });
  return { orderNo, orderStatus: detail.orderStatus, labelUrl, trackingNumber: tracking ?? null };
}

export async function GET(_req: NextRequest, { params }: Context) {
  if (!await hasFreshAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orderId } = await params;
  if (!/^c[a-z0-9]{24,}$/.test(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  try {
    const order = await db.order.findUnique({ where: { id: orderId }, select: {
      shippingServiceCode: true, ship123OrderNo: true, ship123LabelUrl: true, ship123CreateState: true,
    } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    try {
      const products = await getEligibleShip123Products();
      return NextResponse.json({ order, products });
    } catch (error) {
      console.error("[Ship123 admin products]", error);
      return NextResponse.json({ order, products: [], warning: "Could not load current Ship123 services" });
    }
  } catch (error) {
    console.error("[Ship123 admin order]", error);
    return NextResponse.json({ error: "Could not load Ship123 order details" }, { status: 503 });
  }
}

export async function POST(req: NextRequest, { params }: Context) {
  if (!await hasFreshAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orderId } = await params;
  if (!/^c[a-z0-9]{24,}$/.test(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { productCode, knownOrderNo } = parsed.data;
  let claimed = false;
  try {
    const order = await orderForShipping(orderId);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status) || !order.items.length) {
      return NextResponse.json({ error: "Only paid physical orders can receive a shipping label" }, { status: 409 });
    }
    if (order.ship123OrderNo) {
      if (knownOrderNo && knownOrderNo !== order.ship123OrderNo) return NextResponse.json({ error: "Ship123 order number already recorded" }, { status: 409 });
      if (order.shippingServiceCode && order.shippingServiceCode !== productCode) return NextResponse.json({ error: "Shipping service differs from the recorded label" }, { status: 409 });
      const detail = await refreshDetail(orderId, order.ship123OrderNo, productCode, order.carrier ?? "Ship123", false);
      return NextResponse.json(detail, { status: detail.labelUrl ? 200 : 202 });
    }
    const products = await getEligibleShip123Products();
    const product = products.find(value => value.code === productCode);
    if (!product) return NextResponse.json({ error: "This shipping service is not enabled in Ship123" }, { status: 422 });
    if (order.shippingServiceCode && order.shippingServiceCode !== productCode) {
      return NextResponse.json({ error: "Shipping service differs from the paid checkout quote" }, { status: 409 });
    }
    if (knownOrderNo) {
      if (!["CREATING", "UNKNOWN"].includes(order.ship123CreateState ?? "")) {
        return NextResponse.json({ error: "No uncertain Ship123 creation to reconcile" }, { status: 409 });
      }
      if (order.ship123CreateState === "CREATING" && order.ship123CreateStartedAt &&
          Date.now() - order.ship123CreateStartedAt.getTime() < 60_000) {
        return NextResponse.json({ error: "Ship123 creation is still in progress. Wait before reconciling it." }, { status: 409 });
      }
      const detail = await refreshDetail(orderId, knownOrderNo, productCode, product.carrier, true);
      return NextResponse.json(detail, { status: detail.labelUrl ? 200 : 202 });
    }
    if (order.ship123CreateState) {
      return NextResponse.json({ error: "Ship123 creation outcome is uncertain. Find this customer order in Ship123 and attach its order number before trying again." }, { status: 409 });
    }
    if (!["PAID", "CONFIRMED", "PROCESSING"].includes(order.status)) {
      return NextResponse.json({ error: "A shipped order cannot create a new label" }, { status: 409 });
    }
    const sender = ship123SenderFromEnv();
    const packages = order.items.map(item => {
      const variant = item.productVariant;
      const weight = variant?.weight ?? item.product.weight;
      const length = variant?.length ?? item.product.length;
      const width = variant?.width ?? item.product.width;
      const height = variant?.height ?? item.product.height;
      const [parcel] = buildParcelGroups([{ key: item.id, quantity: item.quantity, weight, length, width, height }]);
      return {
        quantity: parcel.count, length: parcel.lengthCm, width: parcel.widthCm,
        height: parcel.heightCm, weight: parcel.weightKg,
        skuList: [{ ...(item.product.sku ? { sku: item.product.sku } : {}), nameEn: item.product.name,
          quantity: item.quantity, declaredValue: Math.round(item.unitPrice * 100) / 100, productType: 1 as const }],
      };
    });
    const claim = await db.order.updateMany({ where: {
      id: orderId, ship123OrderNo: null, ship123CreateState: null,
      status: { in: ["PAID", "CONFIRMED", "PROCESSING"] },
    }, data: { ship123CreateState: "CREATING", ship123CreateStartedAt: new Date() } });
    if (!claim.count) return NextResponse.json({ error: "Another shipping action is in progress. Refresh this order." }, { status: 409 });
    claimed = true;
    const orderNo = await createShip123Order({ customerOrderNo: order.id, productCode, sender, recipient: recipient(order), packages });
    await db.order.update({ where: { id: orderId }, data: { ship123OrderNo: orderNo, ship123CreateState: "CREATED", shippingServiceCode: productCode } });
    claimed = false;
    try {
      const detail = await refreshDetail(orderId, orderNo, productCode, product.carrier, false);
      return NextResponse.json(detail, { status: detail.labelUrl ? 200 : 202 });
    } catch (error) {
      console.error("[Ship123 admin detail]", error);
      return NextResponse.json({ orderNo, message: "Shipping order created. Refresh its detail to retrieve the label." }, { status: 202 });
    }
  } catch (error) {
    if (claimed) {
      // A timed-out create may have succeeded remotely. Never create again automatically.
      await db.order.updateMany({ where: { id: orderId, ship123CreateState: "CREATING", ship123OrderNo: null }, data: { ship123CreateState: "UNKNOWN" } }).catch(() => {});
    }
    console.error("[Ship123 admin order]", error);
    if (error instanceof FreightRequiredError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof Ship123Error) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: "Could not create or refresh the Ship123 order" }, { status: 500 });
  }
}
