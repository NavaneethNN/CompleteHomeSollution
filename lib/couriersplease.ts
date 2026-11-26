import fs from "node:fs";
import path from "node:path";
import type { ParcelGroup } from "@/lib/shipping-packages";
import { cleanAustralianSuburb } from "@/lib/data/australian-suburbs";

export type CouriersPleaseAddress = {
  name: string;
  line1: string;
  line2?: string | null;
  suburb: string;
  state: string;
  postcode: string;
  phone?: string | null;
  email?: string | null;
};

export type CouriersPleaseRate = {
  serviceCode: string;
  serviceName: string;
  price: number;
  deliveryTime: string | null;
  pickupCutOffTime?: string | null;
};

export type CouriersPleaseTrackingEvent = {
  date: string;
  description: string;
  location?: string;
};

export type CouriersPleaseTrackingResult = {
  status?: string;
  normalizedStatus?: "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED";
  isDelivered?: boolean;
  deliveryETA?: string | null;
  deliveredAt?: string | null;
  pod?: string | null;
  events?: CouriersPleaseTrackingEvent[];
};

export class CouriersPleaseError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details?: unknown,
    readonly statusCode?: number
  ) {
    super(message);
    this.name = "CouriersPleaseError";
  }
}

export interface BookedConsignmentDetail {
  boxIndex: number;
  description: string;
  consignmentCode: string;
  rateCardId: string;
  jobNumber: string | null;
  length: number;
  width: number;
  height: number;
  weight: number;
}

export class CouriersPleasePartialBookingError extends CouriersPleaseError {
  constructor(
    message: string,
    readonly partialConsignments: BookedConsignmentDetail[],
    code?: string,
    details?: unknown,
    statusCode?: number
  ) {
    super(message, code, details, statusCode);
    this.name = "CouriersPleasePartialBookingError";
  }
}

/**
 * Splits a persisted tracking/consignment string (single or comma-separated)
 * into clean deduplicated Couriers Please consignment codes.
 */
export function parseConsignmentCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const clean = part.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    codes.push(clean);
  }
  return codes;
}

export function getCouriersPleaseApiBase(): string {
  return (
    getCouriersPleaseEnv("COURIER_PLEASE_API_URL", ["COURIERS_PLEASE_API_URL", "COURIER_PLEASE_BASE_URL"])?.replace(
      /\/+$/,
      ""
    ) || "https://api.couriersplease.com.au"
  );
}

const STATE_TIMEZONES: Record<string, string> = {
  SA: "Australia/Adelaide",
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  VIC: "Australia/Melbourne",
  TAS: "Australia/Hobart",
  QLD: "Australia/Brisbane",
  WA: "Australia/Perth",
  NT: "Australia/Darwin",
};

const PLACEHOLDER_RATE_CODES = new Set([
  "CP_STANDARD",
  "CP_EXPRESS",
  "STANDARD",
  "EXPRESS",
  "FREE_SHIPPING",
  "ROAD_EXPRESS",
  "STORE_PICKUP",
  "MANUAL_DELIVERY",
  "MEMBER_FREE_DELIVERY",
  "MEMBER_FIXED_DELIVERY",
]);

interface CouriersPleaseApiErrorItem {
  description?: string;
  field?: string;
}

interface CouriersPleaseApiResponse<T = Record<string, unknown>> {
  responseCode?: string;
  msg?: string;
  data?: T;
}

function extractCouriersPleaseError(
  result: CouriersPleaseApiResponse<{ errors?: CouriersPleaseApiErrorItem[] } | unknown[]> | null,
  fallback: string
): string {
  if (result?.data && !Array.isArray(result.data) && Array.isArray(result.data.errors) && result.data.errors.length > 0) {
    const joined = result.data.errors
      .map((e: CouriersPleaseApiErrorItem) => e.description || e.field || JSON.stringify(e))
      .filter(Boolean)
      .join(". ");
    if (joined) return joined;
  }
  return result?.msg || fallback;
}

/**
 * Robust environment variable reader:
 * First checks process.env, then falls back to reading .env directly
 * so that any changes in .env are picked up immediately without needing a server restart.
 */
let cachedEnvFile: Record<string, string> | null = null;
let lastEnvReadTime = 0;

function readEnvFromDisk(): Record<string, string> {
  const now = Date.now();
  if (cachedEnvFile && now - lastEnvReadTime < 5000) {
    return cachedEnvFile;
  }
  const result: Record<string, string> = {};
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const file = fs.readFileSync(envPath, "utf-8");
      for (const line of file.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const eqIdx = trimmed.indexOf("=");
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        result[key] = val;
      }
    }
  } catch {
    // ignore
  }
  cachedEnvFile = result;
  lastEnvReadTime = now;
  return result;
}

export function getCouriersPleaseEnv(key: string, aliases: string[] = []): string | undefined {
  const allKeys = [key, ...aliases];
  for (const k of allKeys) {
    if (process.env[k] !== undefined) {
      const val = process.env[k]?.trim();
      if (val) return val;
      if (process.env[k] === "") return undefined;
    }
  }
  const disk = readEnvFromDisk();
  for (const k of allKeys) {
    const val = disk[k]?.trim();
    if (val) return val;
  }
  return undefined;
}

export function isCouriersPleaseTestMode(): boolean {
  const flag = getCouriersPleaseEnv("COURIER_PLEASE_TEST_MODE", ["COURIERS_PLEASE_TEST_MODE"]);
  return flag === "true" || flag === "1";
}

export function couriersPleaseSenderFromEnv(): CouriersPleaseAddress {
  const name =
    getCouriersPleaseEnv("COURIER_PLEASE_SENDER_NAME", ["COURIERS_PLEASE_SENDER_NAME"]) ||
    "Complete Home Solution";
  const street =
    getCouriersPleaseEnv("COURIER_PLEASE_SENDER_STREET", [
      "COURIERS_PLEASE_SENDER_STREET",
      "COURIER_PLEASE_SENDER_LINE1",
      "COURIERS_PLEASE_SENDER_LINE1",
    ]) || "18 Edison Drive";
  const suburb =
    getCouriersPleaseEnv("COURIER_PLEASE_SENDER_SUBURB", ["COURIERS_PLEASE_SENDER_SUBURB"]) ||
    "Golden Grove";
  const state =
    getCouriersPleaseEnv("COURIER_PLEASE_SENDER_STATE", ["COURIERS_PLEASE_SENDER_STATE"]) || "SA";
  const postcode =
    getCouriersPleaseEnv("COURIER_PLEASE_SENDER_POSTCODE", ["COURIERS_PLEASE_SENDER_POSTCODE"]) ||
    "5125";
  const phone =
    getCouriersPleaseEnv("COURIER_PLEASE_SENDER_PHONE", ["COURIERS_PLEASE_SENDER_PHONE"]) ||
    "0401682910";
  const email =
    getCouriersPleaseEnv("COURIER_PLEASE_SENDER_EMAIL", ["COURIERS_PLEASE_SENDER_EMAIL"]) ||
    "info@completehomesollution.com.au";

  if (!street || !suburb || !postcode || !/^\d{4}$/.test(postcode)) {
    throw new CouriersPleaseError("Couriers Please sender address is not configured properly in environment variables");
  }

  return {
    name,
    line1: street,
    suburb,
    state,
    postcode,
    phone,
    email,
  };
}

function getAuthHeader(): string {
  const accountId = getCouriersPleaseEnv("COURIER_PLEASE_ACCOUNT_ID", [
    "COURIERS_PLEASE_ACCOUNT_ID",
    "COURIERSPLEASE_ACCOUNT_ID",
  ]);
  const apiKey = getCouriersPleaseEnv("COURIER_PLEASE_API_KEY", [
    "COURIERS_PLEASE_API_KEY",
    "COURIERSPLEASE_API_KEY",
  ]);

  if (!accountId || !apiKey) {
    throw new CouriersPleaseError("Couriers Please account ID or API key is not configured");
  }

  return "Basic " + Buffer.from(`${accountId}:${apiKey}`).toString("base64");
}

export function checkCouriersPleaseAvailability(): { available: boolean; reason: string | null } {
  const accountId = getCouriersPleaseEnv("COURIER_PLEASE_ACCOUNT_ID", [
    "COURIERS_PLEASE_ACCOUNT_ID",
    "COURIERSPLEASE_ACCOUNT_ID",
  ]);
  const apiKey = getCouriersPleaseEnv("COURIER_PLEASE_API_KEY", [
    "COURIERS_PLEASE_API_KEY",
    "COURIERSPLEASE_API_KEY",
  ]);

  if (!accountId || !apiKey) {
    return { available: false, reason: "Couriers Please credentials not configured" };
  }

  return { available: true, reason: null };
}

/**
 * Split a full name into first and last name for API compatibility.
 */
function splitName(fullName?: string | null): { firstName: string; lastName: string } {
  const trimmed = (fullName || "").trim() || "Customer";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0].slice(0, 50), lastName: "Customer" };
  }
  const firstName = parts[0].slice(0, 50);
  const lastName = parts.slice(1).join(" ").slice(0, 50);
  return { firstName, lastName };
}

/**
 * Format a phone number for Couriers Please (digits only or with standard format).
 */
function cleanPhone(phone?: string | null): string {
  if (!phone) return "0400000000";
  const cleaned = phone.replace(/[^0-9+]/g, "").slice(0, 15);
  return cleaned || "0400000000";
}

/**
 * Converts parcel groups into standard Couriers Please items.
 * Standard domestic courier network has strict limits:
 * - Max physical weight per parcel: 25kg
 * - Max volumetric weight per parcel: 40kg (length * width * height / 4000)
 * - Max dimension: 180cm
 * Large furniture items are automatically packaged as multi-cartons (flat-pack)
 * so Couriers Please can calculate rates and create shipments without rejection.
 */
type PackagedCouriersPleaseItem = {
  quantity: number;
  length: number;
  height: number;
  width: number;
  physicalWeight: number;
  description?: string;
};

const MAX_CP_WEIGHT_KG = 25;
const MAX_CP_CUBIC_WEIGHT_KG = 40;
const MAX_CP_LENGTH_CM = 180;

function ceilCm(dim: number): number {
  const normalized = Math.round(Math.max(0, dim) * 1000) / 1000;
  return Math.max(1, Math.ceil(normalized - 1e-9));
}

function ceilWeightKg(weight: number): number {
  const normalized = Math.round(Math.max(0, weight) * 10000) / 100;
  return Math.max(0.1, Math.ceil(normalized - 1e-9) / 100);
}

function packageShipmentItems(
  entries: Array<{
    quantity: number;
    length: number;
    width: number;
    height: number;
    weight: number;
    description?: string;
  }>
): PackagedCouriersPleaseItem[] {
  const items: PackagedCouriersPleaseItem[] = [];

  for (const entry of entries) {
    const physicalWeight = ceilWeightKg(entry.weight);
    const [length, width, height] = [
      ceilCm(entry.length),
      ceilCm(entry.width),
      ceilCm(entry.height),
    ].sort((a, b) => b - a);
    const count = Math.max(1, Math.round(entry.quantity));
    const cleanDesc = entry.description?.trim().slice(0, 100);

    const volWeight = (length * width * height) / 4000;

    if (
      physicalWeight <= MAX_CP_WEIGHT_KG &&
      volWeight <= MAX_CP_CUBIC_WEIGHT_KG &&
      length <= MAX_CP_LENGTH_CM
    ) {
      items.push({
        quantity: count,
        length,
        width,
        height,
        physicalWeight,
        ...(cleanDesc ? { description: cleanDesc } : {}),
      });
      continue;
    }

    // Split only if an admin-overridden box exceeds Couriers Please single-parcel caps (25kg dead / 40kg cubic / 180cm max dim)
    const factors = [1, 1, 1];
    while (Math.ceil(length / factors[0]) > MAX_CP_LENGTH_CM) {
      factors[0]++;
    }
    const rawDims = [length, width, height];
    const sliceDims = () => [
      Math.max(1, Math.ceil(rawDims[0] / factors[0])),
      Math.max(1, Math.ceil(rawDims[1] / factors[1])),
      Math.max(1, Math.ceil(rawDims[2] / factors[2])),
    ];
    let cur = sliceDims();
    while ((cur[0] * cur[1] * cur[2]) / 4000 > MAX_CP_CUBIC_WEIGHT_KG) {
      let maxIdx = 0;
      if (cur[1] > cur[maxIdx]) maxIdx = 1;
      if (cur[2] > cur[maxIdx]) maxIdx = 2;
      factors[maxIdx]++;
      cur = sliceDims();
    }

    const geoBoxes = factors[0] * factors[1] * factors[2];
    const extraWeightSplit = Math.max(
      1,
      Math.ceil(physicalWeight / (MAX_CP_WEIGHT_KG * geoBoxes))
    );
    const boxCount = geoBoxes * extraWeightSplit;
    const [boxLength, boxWidth, boxHeight] = cur.sort((a, b) => b - a);
    const totalHundredths = Math.max(boxCount * 10, Math.round(physicalWeight * 100));
    const baseHundredths = Math.floor(totalHundredths / boxCount);
    const remainderHundredths = totalHundredths % boxCount;

    if (remainderHundredths > 0) {
      items.push({
        quantity: count * remainderHundredths,
        length: boxLength,
        width: boxWidth,
        height: boxHeight,
        physicalWeight: Math.min(MAX_CP_WEIGHT_KG, (baseHundredths + 1) / 100),
        ...(cleanDesc ? { description: cleanDesc } : {}),
      });
    }
    const baseCount = boxCount - remainderHundredths;
    if (baseCount > 0) {
      items.push({
        quantity: count * baseCount,
        length: boxLength,
        width: boxWidth,
        height: boxHeight,
        physicalWeight: Math.min(MAX_CP_WEIGHT_KG, baseHundredths / 100),
        ...(cleanDesc ? { description: cleanDesc } : {}),
      });
    }
  }

  return items;
}

export function packageItemsForCouriersPlease(groups: ParcelGroup[]): PackagedCouriersPleaseItem[] {
  return packageShipmentItems(
    groups.map((g) => ({
      quantity: g.count,
      length: g.lengthCm,
      width: g.widthCm,
      height: g.heightCm,
      weight: g.weightKg,
    }))
  );
}

async function fetchCouriersPleaseQuoteRaw(
  apiBase: string,
  authHeader: string,
  sender: { suburb: string; postcode: string },
  destination: { suburb: string; state: string; postcode: string },
  items: PackagedCouriersPleaseItem[]
): Promise<CouriersPleaseRate[]> {
  const payload = {
    fromSuburb: cleanAustralianSuburb(sender.suburb),
    fromPostcode: sender.postcode.replace(/\D/g, "").slice(0, 4),
    toSuburb: cleanAustralianSuburb(destination.suburb),
    toPostcode: destination.postcode.replace(/\D/g, "").slice(0, 4),
    items,
  };

  let response: Response;
  try {
    response = await fetch(`${apiBase}/v2/domestic/quote`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("[CouriersPlease] Quote network error:", error);
    throw new CouriersPleaseError("Couriers Please service is currently unreachable", "NETWORK_ERROR", undefined, 503);
  }

  // If destination is outside service area or invalid suburb, Couriers Please returns 404
  if (response.status === 404) {
    console.warn(`[CouriersPlease] Destination not serviceable: ${destination.suburb} ${destination.postcode}`);
    return [];
  }

  const result: CouriersPleaseApiResponse<
    Array<{
      RateCardCode?: string;
      RateCardDescription?: string;
      CalculatedFreightCharge?: number | string;
      CalculatedFuelCharge?: number | string;
      TotalCharge?: number | string;
      InsuranceAmt?: number | string;
      CalculatedGST?: number | string;
      GST?: number | string;
      CalculatedSurcharge?: number | string;
      SurchargeAmt?: number | string;
      SecuritySurcharge?: number | string;
      EstimatedDeliveryDays?: number;
      ETA?: string;
      PickupCutOffTime?: string | null;
    }> | { errors?: CouriersPleaseApiErrorItem[] }
  > | null = await response.json().catch(() => null);
  if (!response.ok || !result || result.responseCode !== "SUCCESS" || !Array.isArray(result.data)) {
    if (result?.responseCode === "404" || result?.msg?.toLowerCase().includes("not found")) {
      return [];
    }

    const errorDetail = extractCouriersPleaseError(result, "Could not retrieve shipping rates from Couriers Please");

    console.error("[CouriersPlease] Quote failed:", {
      status: response.status,
      responseCode: result?.responseCode,
      msg: result?.msg,
      errorDetail,
      errors: result?.data && !Array.isArray(result.data) ? result.data.errors : undefined,
    });
    throw new CouriersPleaseError(errorDetail, result?.responseCode, result?.data, response.status);
  }

  const rates: CouriersPleaseRate[] = [];

  const toCents = (val: unknown): number => {
    const parsed =
      typeof val === "number"
        ? val
        : typeof val === "string"
        ? parseFloat(val)
        : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
  };

  for (const item of result.data) {
    const rateCardCode = typeof item.RateCardCode === "string" ? item.RateCardCode.trim() : "";
    if (!rateCardCode) continue;

    const freightCents = toCents(item.CalculatedFreightCharge);
    const fuelCents = toCents(item.CalculatedFuelCharge);
    const insuranceCents = toCents(item.InsuranceAmt);
    const gstCents = toCents(item.CalculatedGST ?? item.GST);
    const surchargeCents = toCents(
      item.CalculatedSurcharge ?? item.SurchargeAmt ?? item.SecuritySurcharge
    );
    const explicitTotalCents = toCents(item.TotalCharge);
    const componentSumCents =
      freightCents + fuelCents + insuranceCents + gstCents + surchargeCents;
    const totalCents =
      explicitTotalCents > 0
        ? Math.max(explicitTotalCents, componentSumCents)
        : componentSumCents;
    const total = totalCents / 100;

    if (!Number.isFinite(total) || total <= 0) continue;

    rates.push({
      serviceCode: rateCardCode,
      serviceName: item.RateCardDescription
        ? `Couriers Please - ${item.RateCardDescription}`
        : "Couriers Please Road Express",
      price: total,
      deliveryTime: item.ETA || null,
      pickupCutOffTime: item.PickupCutOffTime || null,
    });
  }

  return rates.sort((a, b) => a.price - b.price);
}

function consolidatePackagedItemsForQuote(
  items: PackagedCouriersPleaseItem[]
): PackagedCouriersPleaseItem[] {
  const grouped = new Map<string, PackagedCouriersPleaseItem>();
  for (const item of items) {
    const key = `${item.length}:${item.width}:${item.height}:${item.physicalWeight}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      grouped.set(key, {
        quantity: item.quantity,
        length: item.length,
        width: item.width,
        height: item.height,
        physicalWeight: item.physicalWeight,
      });
    }
  }
  return [...grouped.values()];
}

function isMultiParcelFallbackRejection(err: unknown): err is CouriersPleaseError {
  if (!(err instanceof CouriersPleaseError)) return false;
  if (err.code === "NETWORK_ERROR") return false;
  if (err.statusCode === 401 || err.statusCode === 403) return false;
  return (
    err.statusCode === undefined ||
    err.statusCode === 200 ||
    (err.statusCode >= 400 && err.statusCode < 500)
  );
}

/**
 * Quote shipping rates via Couriers Please v2 API.
 * POST /v2/domestic/quote
 * First checks native multi-parcel quoting; if multiple boxes are rejected or
 * yield no combined rate card (e.g. single-parcel Item Rate lanes), falls back
 * to per-box quoting and aggregates matching or per-box optimal service codes.
 */
export async function getCouriersPleaseRates(
  destination: { suburb: string; state: string; postcode: string },
  groups: ParcelGroup[]
): Promise<CouriersPleaseRate[]> {
  if (!groups.length) return [];

  const sender = couriersPleaseSenderFromEnv();
  const authHeader = getAuthHeader();
  const apiBase = getCouriersPleaseApiBase();

  const items = consolidatePackagedItemsForQuote(packageItemsForCouriersPlease(groups));
  const totalBoxes = items.reduce((sum, it) => sum + it.quantity, 0);

  if (totalBoxes <= 1) {
    return fetchCouriersPleaseQuoteRaw(apiBase, authHeader, sender, destination, items);
  }

  // For multi-box orders: attempt multi-item quote probe, but when multiple physical cartons
  // are booked as independent parcels, quotes must aggregate the actual per-box courier rates
  // rather than letting a single flat consignment minimum underquote the extra packaging boxes.
  let multiQuoteError: CouriersPleaseError | null = null;
  try {
    await fetchCouriersPleaseQuoteRaw(apiBase, authHeader, sender, destination, items);
  } catch (err) {
    if (isMultiParcelFallbackRejection(err)) {
      multiQuoteError = err;
    } else {
      throw err;
    }
  }

  // Quote each unique normalized box shape individually (quantity: 1) and aggregate rates across all boxes.
  const perGroupRates: Array<{ quantity: number; rates: CouriersPleaseRate[] }> = [];
  for (const item of items) {
    const singleItemRates = await fetchCouriersPleaseQuoteRaw(apiBase, authHeader, sender, destination, [
      { ...item, quantity: 1 },
    ]).catch((err) => {
      if (multiQuoteError) throw multiQuoteError;
      throw err;
    });
    if (!singleItemRates.length) {
      if (multiQuoteError) throw multiQuoteError;
      return [];
    }
    perGroupRates.push({ quantity: item.quantity, rates: singleItemRates });
  }

  const commonCodes = new Set(perGroupRates[0].rates.map((r) => r.serviceCode));
  for (const groupResult of perGroupRates.slice(1)) {
    const groupCodes = new Set(groupResult.rates.map((r) => r.serviceCode));
    for (const code of [...commonCodes]) {
      if (!groupCodes.has(code)) {
        commonCodes.delete(code);
      }
    }
  }

  const optimalSeparateTotalCents = perGroupRates.reduce(
    (sum, entry) => sum + Math.round(entry.rates[0].price * 100) * entry.quantity,
    0
  );
  const primarySeparate = perGroupRates[0].rates[0];

  if (commonCodes.size === 0) {
    // Disjoint weight-tier rate cards (e.g. Box 1 qualifies only for TS5 while Box 2 qualifies for TSKG):
    // separate-consignment dispatch quotes and books each box individually, so sum each box's cheapest quote.
    return [
      {
        serviceCode: primarySeparate.serviceCode,
        serviceName: "Couriers Please Road Express (Separate Boxes)",
        price: optimalSeparateTotalCents / 100,
        deliveryTime: primarySeparate.deliveryTime,
        pickupCutOffTime: primarySeparate.pickupCutOffTime,
      },
    ];
  }

  const combinedRates: CouriersPleaseRate[] = [];
  for (const code of commonCodes) {
    const baseRate = perGroupRates[0].rates.find((r) => r.serviceCode === code)!;
    const totalCents = perGroupRates.reduce((sum, entry) => {
      const match = entry.rates.find((r) => r.serviceCode === code)!;
      return sum + Math.round(match.price * 100) * entry.quantity;
    }, 0);

    combinedRates.push({
      serviceCode: code,
      serviceName: baseRate.serviceName,
      price: totalCents / 100,
      deliveryTime: baseRate.deliveryTime,
      pickupCutOffTime: baseRate.pickupCutOffTime,
    });
  }

  combinedRates.sort((a, b) => a.price - b.price);
  if (
    combinedRates.length > 0 &&
    optimalSeparateTotalCents < Math.round(combinedRates[0].price * 100)
  ) {
    combinedRates.unshift({
      serviceCode: primarySeparate.serviceCode,
      serviceName: "Couriers Please Road Express (Separate Boxes)",
      price: optimalSeparateTotalCents / 100,
      deliveryTime: primarySeparate.deliveryTime,
      pickupCutOffTime: primarySeparate.pickupCutOffTime,
    });
  }

  return combinedRates;
}

export function summarizeCouriersPleaseItems(
  items: Array<{ quantity: number; length: number; width: number; height: number; weight: number; description?: string }>
): {
  packagedItems: ReturnType<typeof packageItemsForCouriersPlease>;
  totalItemCount: number;
  totalWeight: number;
} {
  const parcelGroups: ParcelGroup[] = items.map((it, idx) => ({
    key: `item-${idx}`,
    count: it.quantity,
    lengthCm: it.length,
    widthCm: it.width,
    heightCm: it.height,
    weightKg: it.weight,
  }));
  const packagedItems = packageItemsForCouriersPlease(parcelGroups);
  const totalItemCount = packagedItems.reduce((acc, it) => acc + it.quantity, 0);
  const totalWeight = Math.round(packagedItems.reduce((acc, it) => acc + it.physicalWeight * it.quantity, 0) * 100) / 100;
  return { packagedItems, totalItemCount, totalWeight };
}

/**
 * Create a domestic shipment / consignment in Couriers Please.
 * POST /v2/domestic/shipment/create
 */
export async function createCouriersPleaseShipment(input: {
  orderId: string;
  rateCardId?: string | null;
  recipient: CouriersPleaseAddress;
  items: Array<{
    quantity: number;
    length: number;
    width: number;
    height: number;
    weight: number;
    description?: string;
  }>;
  specialInstructions?: string;
}): Promise<{ consignmentCode: string; rateCardId: string; jobNumber?: string | null }> {
  const sender = couriersPleaseSenderFromEnv();
  const authHeader = getAuthHeader();
  const apiBase = getCouriersPleaseApiBase();

  const senderName = splitName(sender.name);
  const recipientName = splitName(input.recipient.name);

  const parcelGroups: ParcelGroup[] = input.items.map((it, idx) => ({
    key: `item-${idx}`,
    count: it.quantity,
    lengthCm: it.length,
    widthCm: it.width,
    heightCm: it.height,
    weightKg: it.weight,
  }));

  // Resolve a genuine quoted Couriers Please RateCardCode valid for this destination and parcel dimensions
  const requestedRateCard = input.rateCardId?.trim();
  const quotes = await getCouriersPleaseRates(
    {
      suburb: input.recipient.suburb,
      state: input.recipient.state,
      postcode: input.recipient.postcode,
    },
    parcelGroups
  );

  if (!quotes.length) {
    throw new CouriersPleaseError(
      `No Couriers Please domestic service is available for ${input.recipient.suburb} ${input.recipient.postcode} with these dimensions/weight.`,
      "UNSERVICEABLE",
      undefined,
      422
    );
  }

  let rateCardCode: string;
  if (
    requestedRateCard &&
    !PLACEHOLDER_RATE_CODES.has(requestedRateCard.toUpperCase()) &&
    quotes.some((q) => q.serviceCode === requestedRateCard)
  ) {
    rateCardCode = requestedRateCard;
  } else {
    rateCardCode = quotes[0].serviceCode;
  }

  const packagedItems = packageShipmentItems(input.items);
  const pickupState = sender.state.replace(/^["']|["']$/g, "").trim().toUpperCase();
  const destState = input.recipient.state.replace(/^["']|["']$/g, "").trim().toUpperCase();
  const destPostcode = input.recipient.postcode.replace(/\D/g, "").slice(0, 4);
  const destSuburb = cleanAustralianSuburb(input.recipient.suburb);
  const destPhone = cleanPhone(input.recipient.phone);
  const destEmail = input.recipient.email?.trim() || sender.email || "orders@completehomesollution.com.au";
  const pickupEmail = sender.email || "info@completehomesollution.com.au";

  const payload = {
    pickupFirstName: senderName.firstName,
    pickupLastName: senderName.lastName,
    pickupCompanyName: sender.name.slice(0, 50),
    pickupEmail,
    pickupAddress1: sender.line1.slice(0, 100),
    pickupAddress2: (sender.line2 || "").slice(0, 100),
    pickupSuburb: cleanAustralianSuburb(sender.suburb),
    pickupState,
    pickupPostcode: sender.postcode.replace(/\D/g, "").slice(0, 4),
    pickupPhone: cleanPhone(sender.phone),
    pickupIsBusiness: true,

    destinationFirstName: recipientName.firstName,
    destinationLastName: recipientName.lastName,
    destinationCompanyName: "",
    destinationEmail: destEmail,
    destinationAddress1: input.recipient.line1.slice(0, 100),
    destinationAddress2: (input.recipient.line2 || "").slice(0, 100),
    destinationSuburb: destSuburb,
    destinationState: destState,
    destinationPostcode: destPostcode,
    destinationPhone: destPhone,
    destinationIsBusiness: false,

    contactFirstName: recipientName.firstName,
    contactLastName: recipientName.lastName,
    contactCompanyName: "",
    contactEmail: destEmail,
    contactAddress1: input.recipient.line1.slice(0, 100),
    contactAddress2: (input.recipient.line2 || "").slice(0, 100),
    contactSuburb: destSuburb,
    contactState: destState,
    contactPostcode: destPostcode,
    contactPhone: destPhone,
    contactIsBusiness: false,

    specialInstruction: (input.specialInstructions || "Authority to leave if safe").slice(0, 140),
    referenceNumber: input.orderId.slice(-30),
    termsAccepted: true,
    dangerousGoods: false,
    rateCardId: rateCardCode,
    items: packagedItems.map((it) => ({
      quantity: it.quantity,
      length: it.length,
      height: it.height,
      width: it.width,
      physicalWeight: it.physicalWeight,
      description: it.description || "Homeware product",
    })),
  };

  if (isCouriersPleaseTestMode()) {
    // In Test Mode: Validate payload against live Couriers Please endpoint without creating actual charge/consignment
    let validateRes: Response;
    try {
      validateRes = await fetch(`${apiBase}/v2/domestic/shipment/validate`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      console.error("[CouriersPlease Test Mode] Validation network error:", error);
      throw new CouriersPleaseError(
        "[Test Mode] Couriers Please validation service is currently unreachable",
        "NETWORK_ERROR",
        undefined,
        503
      );
    }

    const validateData: CouriersPleaseApiResponse<{ errors?: CouriersPleaseApiErrorItem[] }> | null = await validateRes
      .json()
      .catch(() => null);
    if (!validateRes.ok || validateData?.responseCode !== "SUCCESS") {
      const errorDetail = extractCouriersPleaseError(validateData, "Shipment validation failed");
      throw new CouriersPleaseError(
        `[Test Mode] ${errorDetail}`,
        validateData?.responseCode,
        validateData?.data,
        validateRes.status
      );
    }

    const boxSuffixMatch = input.orderId.match(/^(.*)-(B\d+)$/);
    const mockConsignment = boxSuffixMatch
      ? `CPTEST-${boxSuffixMatch[1].slice(-8).toUpperCase()}-${boxSuffixMatch[2]}`
      : `CPTEST-${input.orderId.slice(-8).toUpperCase()}`;
    return { consignmentCode: mockConsignment, rateCardId: rateCardCode, jobNumber: null };
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}/v2/domestic/shipment/create`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("[CouriersPlease] Create shipment network error:", error);
    throw new CouriersPleaseError("Couriers Please service is unreachable while creating shipment", "NETWORK_ERROR", undefined, 503);
  }

  const result: CouriersPleaseApiResponse<{
    consignmentCode?: string;
    jobNumber?: string;
    errors?: CouriersPleaseApiErrorItem[];
  }> | null = await response.json().catch(() => null);
  if (!response.ok || !result || result.responseCode !== "SUCCESS" || !result.data?.consignmentCode) {
    const errorDetail = extractCouriersPleaseError(result, "Failed to create consignment with Couriers Please");
    console.error("[CouriersPlease] Create shipment failed:", {
      status: response.status,
      responseCode: result?.responseCode,
      msg: result?.msg,
      errorDetail,
      data: result?.data,
    });
    throw new CouriersPleaseError(errorDetail, result?.responseCode, result?.data, response.status);
  }

  return {
    consignmentCode: result.data.consignmentCode,
    rateCardId: rateCardCode,
    jobNumber: typeof result.data.jobNumber === "string" && result.data.jobNumber.trim()
      ? result.data.jobNumber.trim()
      : null,
  };
}

export interface CouriersPleaseDispatchResult {
  bookingMode: "SINGLE" | "MULTI_PARCEL" | "SEPARATE_CONSIGNMENTS";
  consignmentCode: string;
  consignmentCodes: string[];
  rateCardId: string;
  jobNumber: string | null;
  consignments: BookedConsignmentDetail[];
}

/**
 * Books Couriers Please shipment(s) for an order:
 * 1. If multiple products/boxes exist, first attempts Couriers Please's native
 *    multi-parcel option (`items[]` in one consignment).
 * 2. If Couriers Please rejects multi-parcel quoting/creation with a client-side 4xx
 *    error (e.g. Item Rate restricted to 1 parcel), falls back cleanly to booking a
 *    separate Couriers Please consignment for each physical box.
 */
export async function createCouriersPleaseDispatch(input: {
  orderId: string;
  rateCardId?: string | null;
  recipient: CouriersPleaseAddress;
  items: Array<{
    quantity: number;
    length: number;
    width: number;
    height: number;
    weight: number;
    description?: string;
  }>;
  specialInstructions?: string;
}): Promise<CouriersPleaseDispatchResult> {
  const unitBoxes: Array<{
    length: number;
    width: number;
    height: number;
    weight: number;
    description: string;
  }> = [];

  for (const item of input.items) {
    const qty = Math.max(1, Math.round(item.quantity));
    const desc = item.description?.trim() || "Homeware product";
    for (let q = 0; q < qty; q++) {
      unitBoxes.push({
        length: item.length,
        width: item.width,
        height: item.height,
        weight: item.weight,
        description: qty > 1 ? `${desc} (${q + 1}/${qty})` : desc,
      });
    }
  }

  if (unitBoxes.length <= 1) {
    const single = await createCouriersPleaseShipment(input);
    const box = unitBoxes[0] ?? {
      length: input.items[0]?.length ?? 30,
      width: input.items[0]?.width ?? 25,
      height: input.items[0]?.height ?? 20,
      weight: input.items[0]?.weight ?? 1,
      description: input.items[0]?.description?.trim() || "Homeware product",
    };
    return {
      bookingMode: "SINGLE",
      consignmentCode: single.consignmentCode,
      consignmentCodes: [single.consignmentCode],
      rateCardId: single.rateCardId,
      jobNumber: single.jobNumber ?? null,
      consignments: [
        {
          boxIndex: 1,
          description: box.description,
          consignmentCode: single.consignmentCode,
          rateCardId: single.rateCardId,
          jobNumber: single.jobNumber ?? null,
          length: box.length,
          width: box.width,
          height: box.height,
          weight: box.weight,
        },
      ],
    };
  }

  // Try Couriers Please native multi-parcel option first
  try {
    const multi = await createCouriersPleaseShipment(input);
    const totalWeight = Math.round(unitBoxes.reduce((s, b) => s + b.weight, 0) * 100) / 100;
    return {
      bookingMode: "MULTI_PARCEL",
      consignmentCode: multi.consignmentCode,
      consignmentCodes: [multi.consignmentCode],
      rateCardId: multi.rateCardId,
      jobNumber: multi.jobNumber ?? null,
      consignments: [
        {
          boxIndex: 1,
          description: `${unitBoxes.length} boxes (Multi-parcel consignment)`,
          consignmentCode: multi.consignmentCode,
          rateCardId: multi.rateCardId,
          jobNumber: multi.jobNumber ?? null,
          length: unitBoxes[0].length,
          width: unitBoxes[0].width,
          height: unitBoxes[0].height,
          weight: totalWeight,
        },
      ],
    };
  } catch (err) {
    // Fall back to separate per-box consignments when Couriers Please rejects multi-parcel creation
    if (!isMultiParcelFallbackRejection(err)) {
      throw err;
    }
  }

  // Fallback: Book one separate consignment per box
  const consignments: BookedConsignmentDetail[] = [];
  const baseRef = input.orderId.replace(/[^a-zA-Z0-9_-]/g, "").slice(-22) || "ORDER";

  for (let i = 0; i < unitBoxes.length; i++) {
    const box = unitBoxes[i];
    const boxOrderId = `${baseRef}-B${i + 1}`;
    try {
      const booked = await createCouriersPleaseShipment({
        orderId: boxOrderId,
        rateCardId: input.rateCardId,
        recipient: input.recipient,
        items: [
          {
            quantity: 1,
            length: box.length,
            width: box.width,
            height: box.height,
            weight: box.weight,
            description: box.description,
          },
        ],
        specialInstructions: input.specialInstructions,
      });

      consignments.push({
        boxIndex: i + 1,
        description: box.description,
        consignmentCode: booked.consignmentCode,
        rateCardId: booked.rateCardId,
        jobNumber: booked.jobNumber ?? null,
        length: box.length,
        width: box.width,
        height: box.height,
        weight: box.weight,
      });
    } catch (boxErr) {
      if (consignments.length > 0) {
        const msg =
          boxErr instanceof Error ? boxErr.message : "Failed creating consignment for an additional box";
        throw new CouriersPleasePartialBookingError(
          `Booked ${consignments.length} of ${unitBoxes.length} box consignments (${consignments
            .map((c) => c.consignmentCode)
            .join(", ")}), but Box ${i + 1} failed: ${msg}`,
          consignments,
          boxErr instanceof CouriersPleaseError ? boxErr.code : "PARTIAL_BOOKING",
          boxErr instanceof CouriersPleaseError ? boxErr.details : undefined,
          boxErr instanceof CouriersPleaseError ? boxErr.statusCode : 502
        );
      }
      throw boxErr;
    }
  }

  const consignmentCodes = consignments.map((c) => c.consignmentCode);
  const jobNumbers = [...new Set(consignments.map((c) => c.jobNumber).filter(Boolean))] as string[];

  return {
    bookingMode: "SEPARATE_CONSIGNMENTS",
    consignmentCode: consignmentCodes.join(", "),
    consignmentCodes,
    rateCardId: consignments[0].rateCardId,
    jobNumber: jobNumbers.length > 0 ? jobNumbers.join(", ") : null,
    consignments,
  };
}

/**
 * Format a Date for Couriers Please bookPickup API: yyyy-MM-dd hh:mm tt
 * e.g. 2026-10-27 10:00 AM
 */
export function formatPickupDateTime(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' is '12'
  const hh = String(hours).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${minutes} ${ampm}`;
}

export function getSenderTimezone(state?: string | null): string {
  const normalized = (state || "SA").trim().toUpperCase();
  return STATE_TIMEZONES[normalized] || "Australia/Adelaide";
}

function getZonedDateParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0 = Sun ... 6 = Sat
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const rawHour = Number(map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(map.minute),
    dayOfWeek: weekdayMap[map.weekday] ?? 1,
  };
}

/**
 * Computes a future weekday business-hours readyDateTime in the sender's Australian timezone.
 * Enforces Couriers Please's `yyyy-MM-dd hh:mm AM/PM` format and avoids booking past timestamps
 * regardless of server timezone (UTC on Vercel vs local workstation).
 */
export function computeDefaultPickupDateTime(senderState?: string | null, now: Date = new Date()): string {
  const tz = getSenderTimezone(senderState);
  const zoned = getZonedDateParts(now, tz);
  // Represent calendar day using UTC calendar math to avoid DST/host offset glitches
  const cursor = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day));
  let targetHour = 10;
  let targetMinute = 0;

  if (zoned.dayOfWeek >= 1 && zoned.dayOfWeek <= 5) {
    const minutesNow = zoned.hour * 60 + zoned.minute;
    if (minutesNow < 9 * 60 + 30) {
      targetHour = 10;
      targetMinute = 0;
    } else if (minutesNow < 13 * 60 + 30) {
      // Round up +60m to next 30-min slot so driver always gets future ready time
      const readyMins = Math.ceil((minutesNow + 60) / 30) * 30;
      if (readyMins <= 14 * 60) {
        targetHour = Math.floor(readyMins / 60);
        targetMinute = readyMins % 60;
      } else {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const yyyy = cursor.getUTCFullYear();
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cursor.getUTCDate()).padStart(2, "0");
  const ampm = targetHour >= 12 ? "PM" : "AM";
  const hour12 = targetHour % 12 || 12;
  const hh = String(hour12).padStart(2, "0");
  const minStr = String(targetMinute).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${minStr} ${ampm}`;
}

/**
 * Book driver pickup for the consignment.
 * POST /v2/domestic/bookPickup
 */
export async function bookCouriersPleasePickup(input: {
  consignmentCode: string;
  consignmentCodes?: string[];
  perConsignmentWeights?: number[];
  readyDateTime?: string;
  totalItemCount: number;
  totalWeight: number;
  specialInstructions?: string;
  pickupInstructions?: string;
  recipient?: CouriersPleaseAddress;
}): Promise<{ jobNumber: string; jobNumbers?: string[]; readyDateTime: string }> {
  const codes = parseConsignmentCodes(
    input.consignmentCodes && input.consignmentCodes.length > 0
      ? input.consignmentCodes.join(",")
      : input.consignmentCode
  );

  if (codes.length > 1) {
    const sender = couriersPleaseSenderFromEnv();
    const readyDateTime = input.readyDateTime || computeDefaultPickupDateTime(sender.state);
    const defaultBoxWeight = Math.max(0.1, Math.round((input.totalWeight / codes.length) * 100) / 100);
    const jobNumbers: string[] = [];

    for (let i = 0; i < codes.length; i++) {
      const res = await bookCouriersPleasePickup({
        consignmentCode: codes[i],
        readyDateTime,
        totalItemCount: 1,
        totalWeight: input.perConsignmentWeights?.[i] ?? defaultBoxWeight,
        specialInstructions: input.specialInstructions,
        pickupInstructions: input.pickupInstructions,
        recipient: input.recipient,
      });
      if (res.jobNumber && !jobNumbers.includes(res.jobNumber)) {
        jobNumbers.push(res.jobNumber);
      }
    }

    return {
      jobNumber: jobNumbers.join(", "),
      jobNumbers,
      readyDateTime,
    };
  }

  const singleCode = codes[0] || input.consignmentCode.trim();
  const sender = couriersPleaseSenderFromEnv();
  const readyDateTime = input.readyDateTime || computeDefaultPickupDateTime(sender.state);

  if (isCouriersPleaseTestMode() || singleCode.startsWith("CPTEST-")) {
    const mockJob = `JOBTEST-${Date.now().toString().slice(-6)}`;
    return { jobNumber: mockJob, jobNumbers: [mockJob], readyDateTime };
  }

  const authHeader = getAuthHeader();
  const apiBase = getCouriersPleaseApiBase();

  const payload: Record<string, unknown> = {
    contactName: (sender.name.trim() || "Dispatch").slice(0, 15),
    contactEmail: sender.email || "info@completehomesollution.com.au",
    readyDateTime,
    consignmentCount: 1,
    consignmentCode: singleCode,
    totalItemCount: Math.min(9999, Math.max(1, Math.round(input.totalItemCount))),
    totalWeight: Math.max(0.1, Math.round(input.totalWeight * 100) / 100),
    pickup: {
      companyName: (sender.name.trim() || "Warehouse").slice(0, 19),
      address1: sender.line1.trim().slice(0, 19),
      address2: (sender.line2 || "").trim().slice(0, 19),
      suburb: cleanAustralianSuburb(sender.suburb),
      postcode: sender.postcode.replace(/\D/g, "").slice(0, 4),
      phoneNumber: cleanPhone(sender.phone).slice(0, 19),
    },
    specialInstructions: (input.pickupInstructions || input.specialInstructions || "Pickup ready").trim().slice(0, 15),
  };

  if (input.recipient) {
    payload.delivery = {
      companyName: (input.recipient.name.trim() || "Customer").slice(0, 19),
      address1: input.recipient.line1.trim().slice(0, 19),
      address2: (input.recipient.line2 || "").trim().slice(0, 19),
      suburb: cleanAustralianSuburb(input.recipient.suburb),
      postcode: input.recipient.postcode.replace(/\D/g, "").slice(0, 4),
    };
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}/v2/domestic/bookPickup`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("[CouriersPlease] Book pickup network error:", error);
    throw new CouriersPleaseError("Couriers Please service is unreachable while booking pickup", "NETWORK_ERROR", undefined, 503);
  }

  const result: CouriersPleaseApiResponse<{
    jobNumber?: string;
    errors?: CouriersPleaseApiErrorItem[];
  }> | null = await response.json().catch(() => null);
  if (!response.ok || !result || result.responseCode !== "SUCCESS" || !result.data?.jobNumber) {
    const errorDetail = extractCouriersPleaseError(result, "Failed to book courier pickup with Couriers Please");
    console.error("[CouriersPlease] Book pickup failed:", {
      status: response.status,
      responseCode: result?.responseCode,
      msg: result?.msg,
      errorDetail,
      data: result?.data,
    });
    throw new CouriersPleaseError(errorDetail, result?.responseCode, result?.data, response.status);
  }

  return { jobNumber: result.data.jobNumber, jobNumbers: [result.data.jobNumber], readyDateTime };
}

/**
 * Get the domestic shipping label (Base64 PDF) from Couriers Please.
 * GET /v1/domestic/shipment/label?consignmentNumber=...
 */
export async function getCouriersPleaseLabel(consignmentNumber: string): Promise<string | null> {
  if (consignmentNumber.startsWith("CPTEST-") || isCouriersPleaseTestMode()) {
    return null;
  }

  const authHeader = getAuthHeader();
  const apiBase = getCouriersPleaseApiBase();

  let response: Response;
  try {
    response = await fetch(
      `${apiBase}/v1/domestic/shipment/label?consignmentNumber=${encodeURIComponent(consignmentNumber)}`,
      {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    );
  } catch (error) {
    console.error("[CouriersPlease] Get label network error:", error);
    return null;
  }

  const result: CouriersPleaseApiResponse<{ label?: string }> | null = await response.json().catch(() => null);
  if (response.ok && result?.responseCode === "SUCCESS" && typeof result.data?.label === "string" && result.data.label.trim()) {
    return result.data.label.replace(/\s+/g, "");
  }

  console.warn("[CouriersPlease] Label not yet available or failed:", result?.msg);
  return null;
}

/**
 * Classifies Couriers Please status text or latest tracking action into monotonic order milestones.
 * Checks failed delivery / attempts and partial delivery ("Delivered 1 of 2") BEFORE delivered checks
 * so failed or partial scans never mark an order DELIVERED falsely.
 */
export function classifyCouriersPleaseStatus(
  statusRaw: string,
  latestAction?: string
): { normalizedStatus: "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | null; isDelivered: boolean } {
  const combined = [statusRaw, latestAction].filter(Boolean).join(" ").trim();
  if (!combined) return { normalizedStatus: null, isDelivered: false };
  const s = combined.toLowerCase().replace(/[-_]+/g, " ");

  // 1. Exceptions / futile / delivery attempts never equal DELIVERED
  if (
    /\b(attempt|attempted|fail|failed|futile|unable|undelivered|exception|card left|return to sender|not delivered)\b/.test(
      s
    )
  ) {
    return { normalizedStatus: "SHIPPED", isDelivered: false };
  }

  // 2. Partial multi-piece delivery check (e.g., "Delivered 1 of 2")
  const partialMatch = statusRaw.toLowerCase().match(/(\d+)\s+of\s+(\d+)/);
  if (partialMatch && statusRaw.toLowerCase().includes("deliver")) {
    const done = Number(partialMatch[1]);
    const total = Number(partialMatch[2]);
    if (total > 0 && done < total) {
      return { normalizedStatus: "OUT_FOR_DELIVERY", isDelivered: false };
    }
    if (total > 0 && done >= total) {
      return { normalizedStatus: "DELIVERED", isDelivered: true };
    }
  }

  // 3. Out for delivery / on board (must precede general deliver* matching!)
  if (
    /\b(out for delivery|on board( for delivery)?|with driver|on van|on vehicle for delivery)\b/.test(s)
  ) {
    return { normalizedStatus: "OUT_FOR_DELIVERY", isDelivered: false };
  }

  // 4. Genuine full delivery confirmation
  if (
    /^delivered$/.test(s.trim()) ||
    /\b(goods delivered|item has been delivered|signed for by|pod|delivered to|safe drop completed|delivery completed|authority to leave)\b/.test(
      s
    ) ||
    (/\bdelivered\b/.test(s) && !/\b(scheduled|ready|due|eta|to be)\b/.test(s))
  ) {
    return { normalizedStatus: "DELIVERED", isDelivered: true };
  }

  // 5. Transit / pickup milestones (exclude "Manifest Created" — consignment created prior to pickup)
  if (/\b(in transit|transit|picked up|collected|depot|sorting|sorted|arrived|despatch|dispatch)\b/.test(s)) {
    return { normalizedStatus: "SHIPPED", isDelivered: false };
  }

  return { normalizedStatus: null, isDelivered: false };
}

async function fetchSingleConsignmentTracking(
  cleanCode: string
): Promise<CouriersPleaseTrackingResult | null> {
  if (!cleanCode) return null;

  if (isCouriersPleaseTestMode() || cleanCode.startsWith("CPTEST-")) {
    return {
      status: "IN_TRANSIT",
      normalizedStatus: "SHIPPED",
      isDelivered: false,
      deliveryETA: null,
      deliveredAt: null,
      pod: null,
      events: [
        { date: new Date().toISOString(), description: "Dispatched from Golden Grove warehouse (Simulation Mode)" },
      ],
    };
  }

  const authHeader = getAuthHeader();
  const apiBase = getCouriersPleaseApiBase();

  try {
    const response = await fetch(
      `${apiBase}/v1/domestic/locateParcel?trackingCode=${encodeURIComponent(cleanCode)}`,
      {
        headers: { Authorization: authHeader, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) return null;
    type TrackingItem = {
      action?: string;
      description?: string;
      date?: string;
      time?: string;
      dateTime?: string;
      location?: string;
      depot?: string;
      status?: string;
      timestamp?: string;
    };
    const result: CouriersPleaseApiResponse<{
      status?: string;
      events?: TrackingItem[];
      trackingEvents?: TrackingItem[];
      consignmentInfo?: Array<{
        consignmentCode?: string;
        status?: string;
        deliveredAt?: string | null;
        deliveryETA?: string | null;
        pod?: string | null;
        itemsCoupons?: Array<{
          trackingInfo?: TrackingItem[];
        }>;
      }>;
    }> | null = await response.json().catch(() => null);
    if (result?.responseCode !== "SUCCESS" || !result?.data) return null;

    // Parse live Couriers Please locateParcel structure: data.consignmentInfo[0].itemsCoupons[].trackingInfo[]
    const consignmentList = Array.isArray(result.data.consignmentInfo) ? result.data.consignmentInfo : [];
    const info = consignmentList[0];

    const rawEvents: CouriersPleaseTrackingEvent[] = [];
    const seen = new Set<string>();

    if (info && Array.isArray(info.itemsCoupons)) {
      for (const coupon of info.itemsCoupons) {
        if (!Array.isArray(coupon?.trackingInfo)) continue;
        for (const ev of coupon.trackingInfo) {
          const action = String(ev?.action || ev?.description || "").trim();
          if (!action || action.toLowerCase() === "no scan events found") continue;
          const datePart = [ev?.date, ev?.time].filter(Boolean).join(" ").trim() || ev?.dateTime || "";
          const location = ev?.location || ev?.depot || undefined;
          const dedupeKey = `${datePart}|${action}|${location || ""}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          rawEvents.push({
            date: datePart || new Date().toISOString(),
            description: action,
            ...(location ? { location } : {}),
          });
        }
      }
    } else if (Array.isArray(result.data.events || result.data.trackingEvents)) {
      for (const ev of result.data.events || result.data.trackingEvents || []) {
        const desc = String(ev?.description || ev?.action || ev?.status || "").trim();
        if (!desc) continue;
        rawEvents.push({
          date: String(ev?.date || ev?.timestamp || new Date().toISOString()),
          description: desc,
          ...(ev?.location ? { location: String(ev.location) } : {}),
        });
      }
    }

    // Newest events first when timestamps parse cleanly
    const events = rawEvents.sort((a, b) => {
      const ta = Date.parse(a.date);
      const tb = Date.parse(b.date);
      if (!isNaN(ta) && !isNaN(tb)) return tb - ta;
      return 0;
    });

    const rawStatus = String(info?.status || result.data?.status || "").trim();
    const latestAction = events[0]?.description || "";
    const statusText = rawStatus || latestAction || "";

    if (!info?.consignmentCode && !statusText && events.length === 0) {
      return null;
    }

    const classified = classifyCouriersPleaseStatus(rawStatus, latestAction);
    const hasDeliveredTimestamp =
      Boolean(info?.deliveredAt && String(info.deliveredAt).trim()) && !/\b(attempt|fail|futile)\b/i.test(statusText);
    const isDelivered = classified.isDelivered || hasDeliveredTimestamp;
    const normalizedStatus = isDelivered ? "DELIVERED" : classified.normalizedStatus ?? undefined;

    return {
      status: statusText || "In Transit",
      normalizedStatus,
      isDelivered,
      deliveryETA: info?.deliveryETA ? String(info.deliveryETA).trim() : null,
      deliveredAt: info?.deliveredAt ? String(info.deliveredAt).trim() : null,
      pod: info?.pod ? String(info.pod).trim() : null,
      events,
    };
  } catch (err) {
    console.error("[CouriersPlease] Tracking query error:", err);
  }

  return null;
}

/**
 * Fetch tracking details / events for one or multiple Couriers Please consignments
 * via /v1/domestic/locateParcel. For orders booked as separate per-box consignments,
 * only reports DELIVERED once every consignment reports delivered.
 */
export async function getCouriersPleaseTracking(
  consignmentNumber: string
): Promise<CouriersPleaseTrackingResult | null> {
  const codes = parseConsignmentCodes(consignmentNumber);
  if (codes.length === 0) return null;
  if (codes.length === 1) {
    return fetchSingleConsignmentTracking(codes[0]);
  }

  const results = await Promise.all(
    codes.map(async (code) => ({ code, result: await fetchSingleConsignmentTracking(code) }))
  );

  const nonNull = results.filter((entry) => entry.result !== null) as Array<{
    code: string;
    result: CouriersPleaseTrackingResult;
  }>;
  if (nonNull.length === 0) return null;

  const allDelivered =
    nonNull.length === codes.length && nonNull.every((entry) => Boolean(entry.result.isDelivered));
  const anyDelivered = nonNull.some((entry) => Boolean(entry.result.isDelivered));
  const anyOutForDelivery = nonNull.some(
    (entry) => entry.result.normalizedStatus === "OUT_FOR_DELIVERY"
  );
  const anyShipped = nonNull.some((entry) => entry.result.normalizedStatus === "SHIPPED");

  const normalizedStatus: CouriersPleaseTrackingResult["normalizedStatus"] = allDelivered
    ? "DELIVERED"
    : anyOutForDelivery || anyDelivered
    ? "OUT_FOR_DELIVERY"
    : anyShipped
    ? "SHIPPED"
    : undefined;

  const combinedEvents = nonNull
    .flatMap((entry) =>
      (entry.result.events ?? []).map((ev) => ({
        ...ev,
        description: `[${entry.code}] ${ev.description}`,
      }))
    )
    .sort((a, b) => {
      const ta = Date.parse(a.date);
      const tb = Date.parse(b.date);
      if (!isNaN(ta) && !isNaN(tb)) return tb - ta;
      return 0;
    });

  const deliveredCount = nonNull.filter((e) => e.result.isDelivered).length;
  const statusSummary = allDelivered
    ? "Delivered (All consignments)"
    : anyDelivered
    ? `Partial delivery (${deliveredCount}/${codes.length} consignments delivered)`
    : nonNull.find((e) => e.result.status)?.result.status || "In Transit";

  return {
    status: statusSummary,
    normalizedStatus,
    isDelivered: allDelivered,
    deliveryETA: nonNull.find((e) => e.result.deliveryETA)?.result.deliveryETA ?? null,
    deliveredAt: allDelivered
      ? nonNull.find((e) => e.result.deliveredAt)?.result.deliveredAt ?? null
      : null,
    pod: allDelivered ? nonNull.find((e) => e.result.pod)?.result.pod ?? null : null,
    events: combinedEvents,
  };
}

