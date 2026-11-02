import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let session: { user: { id: string; role: string } } | null = { user: { id: "admin-1", role: "ADMIN" } };
let pendingOrderCount = 0;
let postcodes: Array<{ id: string; postcode: string; suburb: string | null; charge: number; isActive: boolean }> = [];

let mockOrders: Record<string, any> = {};

const db = {
  manualDeliveryPostcode: {
    findMany: async () => structuredClone(postcodes),
    findUnique: async ({ where }: any) => {
      const match = postcodes.find((p) => (where.id ? p.id === where.id : p.postcode === where.postcode));
      return match ? structuredClone(match) : null;
    },
    create: async ({ data }: any) => {
      const record = { id: `mdp-${postcodes.length + 1}`, ...data };
      postcodes.push(record);
      return structuredClone(record);
    },
    update: async ({ where, data }: any) => {
      const item = postcodes.find((p) => p.id === where.id);
      if (!item) throw new Error("Not found");
      Object.assign(item, data);
      return structuredClone(item);
    },
    delete: async ({ where }: any) => {
      const idx = postcodes.findIndex((p) => p.id === where.id);
      if (idx !== -1) postcodes.splice(idx, 1);
      return { id: where.id };
    },
  },
  order: {
    count: async () => pendingOrderCount,
    findUnique: async ({ where }: any) => mockOrders[where.id] ? structuredClone(mockOrders[where.id]) : null,
    update: async ({ where, data }: any) => {
      if (!mockOrders[where.id]) throw new Error("Order not found");
      Object.assign(mockOrders[where.id], data);
      return structuredClone(mockOrders[where.id]);
    },
  },
  emailJob: {
    createMany: async () => ({ count: 1 }),
    findMany: async () => [],
  },
  $transaction: async (fn: (tx: any) => Promise<any>) => fn(db),
};

function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}

stub("../auth", { auth: async () => session });
stub("../lib/db", { db });
stub("next/cache", { revalidatePath: () => {} });

const {
  deleteManualDeliveryPostcode,
  updateManualDeliveryPostcode,
  createManualDeliveryPostcode,
  updateOrderPickupDetails,
} = require("../lib/actions/manual-delivery") as typeof import("../lib/actions/manual-delivery");

test("manual delivery postcode operations require admin privileges", async () => {
  session = null;
  await assert.rejects(async () => {
    await deleteManualDeliveryPostcode("mdp-1");
  }, /Unauthorized/);
  session = { user: { id: "admin-1", role: "ADMIN" } };
});

test("deleting a manual delivery postcode is blocked if active pending checkout orders exist", async () => {
  postcodes = [{ id: "mdp-1", postcode: "2000", suburb: "Sydney", charge: 25, isActive: true }];
  pendingOrderCount = 2;

  const result = await deleteManualDeliveryPostcode("mdp-1");
  assert.equal(result.success, false);
  assert.match(result.error!, /2 active pending order\(s\)/);
  assert.equal(postcodes.length, 1); // Not deleted

  // When no pending orders exist, deletion succeeds
  pendingOrderCount = 0;
  const successResult = await deleteManualDeliveryPostcode("mdp-1");
  assert.equal(successResult.success, true);
  assert.equal(postcodes.length, 0); // Deleted
});

test("deactivating a manual delivery postcode is blocked if active pending checkout orders exist", async () => {
  postcodes = [{ id: "mdp-2", postcode: "3000", suburb: "Melbourne", charge: 30, isActive: true }];
  pendingOrderCount = 1;

  const result = await updateManualDeliveryPostcode("mdp-2", { isActive: false });
  assert.equal(result.success, false);
  assert.match(result.error!, /1 active pending order\(s\)/);
  assert.equal(postcodes[0].isActive, true); // Kept active

  // When no pending orders exist, deactivation succeeds
  pendingOrderCount = 0;
  const successResult = await updateManualDeliveryPostcode("mdp-2", { isActive: false });
  assert.equal(successResult.success, true);
  assert.equal(postcodes[0].isActive, false); // Deactivated
});

test("updateOrderPickupDetails blocks completing pickup on unpaid PENDING or cancelled orders", async () => {
  mockOrders["order-pending"] = { id: "order-pending", status: "PENDING", refundRequested: false, refundProcessing: false };
  const resPending = await updateOrderPickupDetails("order-pending", { pickupStatus: "PICKED_UP" });
  assert.equal(resPending.success, false);
  assert.match(resPending.error!, /unpaid PENDING order/);

  mockOrders["order-cancelled"] = { id: "order-cancelled", status: "CANCELLED", refundRequested: false, refundProcessing: false };
  const resCancelled = await updateOrderPickupDetails("order-cancelled", { pickupStatus: "PICKED_UP" });
  assert.equal(resCancelled.success, false);
  assert.match(resCancelled.error!, /cancelled/);

  mockOrders["order-paid"] = { id: "order-paid", status: "PAID", refundRequested: false, refundProcessing: false };
  const resPaid = await updateOrderPickupDetails("order-paid", { pickupStatus: "PICKED_UP" });
  assert.equal(resPaid.success, true);
  assert.equal(mockOrders["order-paid"].status, "DELIVERED");
  assert.equal(mockOrders["order-paid"].pickupStatus, "PICKED_UP");

  // Setting READY_FOR_PICKUP promotes PAID to PROCESSING
  mockOrders["order-ready"] = { id: "order-ready", status: "PAID", refundRequested: false, refundProcessing: false };
  const resReady = await updateOrderPickupDetails("order-ready", { pickupStatus: "READY_FOR_PICKUP" });
  assert.equal(resReady.success, true);
  assert.equal(mockOrders["order-ready"].status, "PROCESSING");
  assert.equal(mockOrders["order-ready"].pickupStatus, "READY_FOR_PICKUP");
});

test("getEffectiveOrderStatus and formatAppointmentDate calculate store pickup badges correctly", () => {
  const { getEffectiveOrderStatus, formatAppointmentDate } = require("../lib/order-display") as typeof import("../lib/order-display");

  // Format date and time
  const formatted = formatAppointmentDate(new Date("2026-11-15T10:30:00Z"), "10:30 AM");
  assert.match(formatted!, /Nov/);
  assert.match(formatted!, /10:30 AM/);

  // Store Pickup - Scheduled appointment
  const scheduledOrder = {
    status: "CONFIRMED",
    fulfillmentType: "STORE_PICKUP",
    pickupStatus: "SCHEDULED",
    pickupAppointmentDate: new Date("2026-11-15T10:30:00Z"),
    pickupAppointmentTime: "10:30 AM",
  };
  const scheduledStatus = getEffectiveOrderStatus(scheduledOrder);
  assert.equal(scheduledStatus.label, "Pickup Scheduled");
  assert.equal(scheduledStatus.isPickup, true);
  assert.equal(scheduledStatus.isAppointmentScheduled, true);
  assert.equal(scheduledStatus.isReadyForPickup, false);
  assert.equal(scheduledStatus.isPickedUp, false);
  assert.match(scheduledStatus.appointmentFormatted!, /10:30 AM/);

  // Store Pickup - Ready for pickup
  const readyOrder = {
    status: "PROCESSING",
    fulfillmentType: "STORE_PICKUP",
    pickupStatus: "READY_FOR_PICKUP",
  };
  const readyStatus = getEffectiveOrderStatus(readyOrder);
  assert.equal(readyStatus.label, "Ready for Pickup");
  assert.equal(readyStatus.isReadyForPickup, true);
  assert.equal(readyStatus.isPickedUp, false);

  // Store Pickup - Picked up
  const completedOrder = {
    status: "DELIVERED",
    fulfillmentType: "STORE_PICKUP",
    pickupStatus: "PICKED_UP",
  };
  const completedStatus = getEffectiveOrderStatus(completedOrder);
  assert.equal(completedStatus.label, "Picked Up & Completed");
  assert.equal(completedStatus.isPickedUp, true);

  // Delivery order - Standard status preserved
  const deliveryOrder = {
    status: "SHIPPED",
    fulfillmentType: "DELIVERY",
  };
  const deliveryStatus = getEffectiveOrderStatus(deliveryOrder);
  assert.equal(deliveryStatus.label, "Shipped");
  assert.equal(deliveryStatus.isPickup, false);
});


