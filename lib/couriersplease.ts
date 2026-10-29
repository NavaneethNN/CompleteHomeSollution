import fs from "node:fs";
import path from "node:path";
import type { ParcelGroup } from "@/lib/shipping-packages";
import { cleanAustralianSuburb } from "@/lib/data/australian-suburbs";

const API_BASE = "https://api.couriersplease.com.au";

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
};

export class CouriersPleaseError extends Error {
  constructor(message: string, readonly code?: string, readonly details?: unknown) {
    super(message);
    this.name = "CouriersPleaseError";
  }
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

function createSampleLabelPdf(consignment: string): string {
  const content = `BT
/F1 22 Tf
50 720 Td
(COURIERS PLEASE SHIPPING LABEL [TEST MODE]) Tj
0 -35 Td
/F1 13 Tf
(Consignment Number: ${consignment}) Tj
0 -25 Td
(Carrier: Couriers Please - Road Express) Tj
0 -25 Td
(Sender: Complete Home Solution, Golden Grove SA 5125) Tj
0 -25 Td
(Recipient: Test Customer Delivery Address) Tj
0 -40 Td
/F1 10 Tf
(This label was generated in Couriers Please TEST MODE for booking verification.) Tj
0 -15 Td
(No physical courier collection has been dispatched.) Tj
ET`;

  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${content.length} >>
stream
${content}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000244 00000 n 
0000000315 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
${400 + content.length}
%%EOF`;

  return Buffer.from(pdf).toString("base64");
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
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim() || "Customer";
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
  const cleaned = phone.replace(/[^0-9+]/g, "");
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
function packageItemsForCouriersPlease(groups: ParcelGroup[]): Array<{
  quantity: number;
  length: number;
  height: number;
  width: number;
  physicalWeight: number;
  description?: string;
}> {
  const items: Array<{
    quantity: number;
    length: number;
    height: number;
    width: number;
    physicalWeight: number;
    description?: string;
  }> = [];

  for (const g of groups) {
    const rawWeight = Math.max(0.1, g.weightKg);
    const rawLength = Math.max(1, Math.round(g.lengthCm));
    const rawWidth = Math.max(1, Math.round(g.widthCm));
    const rawHeight = Math.max(1, Math.round(g.heightCm));
    const count = Math.max(1, Math.round(g.count));

    const volWeight = (rawLength * rawWidth * rawHeight) / 4000;
    const boxesByWeight = Math.ceil(rawWeight / 24);
    const boxesByVol = Math.ceil(volWeight / 36);
    const boxesByLength = Math.ceil(rawLength / 160);
    const boxCount = Math.max(1, boxesByWeight, boxesByVol, boxesByLength);

    if (boxCount === 1) {
      items.push({
        quantity: count,
        length: Math.min(170, Math.max(5, rawLength)),
        width: Math.min(100, Math.max(5, rawWidth)),
        height: Math.min(100, Math.max(5, rawHeight)),
        physicalWeight: Math.min(24.5, Math.max(0.1, Math.round(rawWeight * 100) / 100)),
      });
    } else {
      // Split into multi-carton shipment (e.g. flat-pack boxes)
      const weightPerBox = Math.min(24, Math.max(0.5, Math.round((rawWeight / boxCount) * 10) / 10));
      const lengthPerBox = Math.min(150, Math.max(10, Math.round(rawLength / (boxesByLength > 1 ? boxesByLength : 1))));
      const widthPerBox = Math.min(80, Math.max(10, rawWidth));
      const heightPerBox = Math.min(50, Math.max(5, Math.round(rawHeight / (boxesByVol > 1 ? boxesByVol : 1))));

      for (let b = 0; b < boxCount; b++) {
        items.push({
          quantity: count,
          length: lengthPerBox,
          width: widthPerBox,
          height: heightPerBox,
          physicalWeight: weightPerBox,
        });
      }
    }
  }

  return items;
}

/**
 * Quote shipping rates via Couriers Please v2 API.
 * POST /v2/domestic/quote
 */
export async function getCouriersPleaseRates(
  destination: { suburb: string; state: string; postcode: string },
  groups: ParcelGroup[]
): Promise<CouriersPleaseRate[]> {
  if (!groups.length) return [];

  const sender = couriersPleaseSenderFromEnv();
  const authHeader = getAuthHeader();

  const items = packageItemsForCouriersPlease(groups);

  const payload = {
    fromSuburb: cleanAustralianSuburb(sender.suburb),
    fromPostcode: sender.postcode.replace(/\D/g, "").slice(0, 4),
    toSuburb: cleanAustralianSuburb(destination.suburb),
    toPostcode: destination.postcode.replace(/\D/g, "").slice(0, 4),
    items,
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v2/domestic/quote`, {
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
    throw new CouriersPleaseError("Couriers Please service is currently unreachable");
  }

  // If destination is outside service area or invalid suburb, Couriers Please returns 404
  if (response.status === 404) {
    console.warn(`[CouriersPlease] Destination not serviceable: ${destination.suburb} ${destination.postcode}`);
    return [];
  }

  const result: any = await response.json().catch(() => null);
  if (!response.ok || !result || result.responseCode !== "SUCCESS" || !Array.isArray(result.data)) {
    if (result?.responseCode === "404" || result?.msg?.toLowerCase().includes("not found")) {
      return [];
    }

    let errorDetail = result?.msg || "Could not retrieve shipping rates from Couriers Please";
    if (result?.data?.errors && Array.isArray(result.data.errors) && result.data.errors.length > 0) {
      errorDetail = result.data.errors
        .map((e: any) => e.description || e.field || JSON.stringify(e))
        .filter(Boolean)
        .join(". ");
    }

    console.error("[CouriersPlease] Quote failed:", {
      status: response.status,
      responseCode: result?.responseCode,
      msg: result?.msg,
      errorDetail,
      errors: result?.data?.errors,
    });
    throw new CouriersPleaseError(errorDetail, result?.responseCode, result?.data);
  }

  const rates: CouriersPleaseRate[] = [];

  for (const item of result.data) {
    const freight = parseFloat(item.CalculatedFreightCharge || "0");
    const fuel = parseFloat(item.CalculatedFuelCharge || "0");
    const total = Math.round((freight + fuel) * 100) / 100;

    if (isNaN(total) || total <= 0) continue;

    rates.push({
      serviceCode: item.RateCardCode || "ROAD_EXPRESS",
      serviceName: item.RateCardDescription
        ? `Couriers Please - ${item.RateCardDescription}`
        : "Couriers Please Express",
      price: total,
      deliveryTime: item.ETA || null,
    });
  }

  // Sort lowest price first
  return rates.sort((a, b) => a.price - b.price);
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
}): Promise<{ consignmentCode: string }> {
  const sender = couriersPleaseSenderFromEnv();
  const authHeader = getAuthHeader();

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

  // If rateCardId is not provided, fetch quotes to pick the lowest valid rateCardCode
  let rateCardCode = input.rateCardId?.trim();
  if (!rateCardCode) {
    const quotes = await getCouriersPleaseRates(
      { suburb: input.recipient.suburb, state: input.recipient.state, postcode: input.recipient.postcode },
      parcelGroups
    );
    rateCardCode = quotes[0]?.serviceCode || "TS3";
  }

  const packagedItems = packageItemsForCouriersPlease(parcelGroups);

  const payload = {
    pickupFirstName: senderName.firstName,
    pickupLastName: senderName.lastName,
    pickupCompanyName: sender.name.slice(0, 50),
    pickupEmail: sender.email || "info@completehomesollution.com.au",
    pickupAddress1: sender.line1.slice(0, 100),
    pickupAddress2: (sender.line2 || "").slice(0, 100),
    pickupSuburb: sender.suburb.replace(/^["']|["']$/g, "").trim(),
    pickupState: sender.state.replace(/^["']|["']$/g, "").trim(),
    pickupPostcode: sender.postcode.replace(/^["']|["']$/g, "").trim(),
    pickupPhone: cleanPhone(sender.phone),
    pickupIsBusiness: true,

    destinationFirstName: recipientName.firstName,
    destinationLastName: recipientName.lastName,
    destinationCompanyName: "",
    destinationEmail: input.recipient.email || "customer@example.com",
    destinationAddress1: input.recipient.line1.slice(0, 100),
    destinationAddress2: (input.recipient.line2 || "").slice(0, 100),
    destinationSuburb: cleanAustralianSuburb(input.recipient.suburb),
    destinationState: input.recipient.state.replace(/^["']|["']$/g, "").trim(),
    destinationPostcode: input.recipient.postcode.replace(/\D/g, "").slice(0, 4),
    destinationPhone: cleanPhone(input.recipient.phone),
    destinationIsBusiness: false,

    contactFirstName: recipientName.firstName,
    contactLastName: recipientName.lastName,
    contactCompanyName: "",
    contactEmail: input.recipient.email || "customer@example.com",
    contactAddress1: input.recipient.line1.slice(0, 100),
    contactAddress2: (input.recipient.line2 || "").slice(0, 100),
    contactSuburb: cleanAustralianSuburb(input.recipient.suburb),
    contactState: input.recipient.state.replace(/^["']|["']$/g, "").trim(),
    contactPostcode: input.recipient.postcode.replace(/\D/g, "").slice(0, 4),
    contactPhone: cleanPhone(input.recipient.phone),
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
      description: "Homeware product",
    })),
  };

  if (isCouriersPleaseTestMode()) {
    // In Test Mode: Validate payload against live Couriers Please endpoint without creating actual charge/consignment
    try {
      const validateRes = await fetch(`${API_BASE}/v2/domestic/shipment/validate`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const validateData: any = await validateRes.json().catch(() => null);
      if (!validateRes.ok || validateData?.responseCode !== "SUCCESS") {
        let errorDetail = validateData?.msg || "Shipment validation failed";
        if (validateData?.data?.errors?.length) {
          errorDetail = validateData.data.errors.map((e: any) => e.description || e.field).join(". ");
        }
        throw new CouriersPleaseError(`[Test Mode] ${errorDetail}`, validateData?.responseCode, validateData?.data);
      }
    } catch (err) {
      if (err instanceof CouriersPleaseError) throw err;
      console.warn("[CouriersPlease Test Mode] Validation endpoint skipped/warning:", err);
    }

    const mockConsignment = `CPTEST-${input.orderId.slice(-8).toUpperCase()}`;
    return { consignmentCode: mockConsignment };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v2/domestic/shipment/create`, {
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
    throw new CouriersPleaseError("Couriers Please service is unreachable while creating shipment");
  }

  const result: any = await response.json().catch(() => null);
  if (!response.ok || !result || result.responseCode !== "SUCCESS" || !result.data?.consignmentCode) {
    let errorDetail = result?.msg || "Failed to create consignment with Couriers Please";
    if (result?.data?.errors && Array.isArray(result.data.errors) && result.data.errors.length > 0) {
      errorDetail = result.data.errors
        .map((e: any) => e.description || e.field || JSON.stringify(e))
        .filter(Boolean)
        .join(". ");
    }
    console.error("[CouriersPlease] Create shipment failed:", {
      status: response.status,
      responseCode: result?.responseCode,
      msg: result?.msg,
      errorDetail,
      data: result?.data,
    });
    throw new CouriersPleaseError(errorDetail, result?.responseCode, result?.data);
  }

  return { consignmentCode: result.data.consignmentCode };
}

/**
 * Format a Date for Couriers Please bookPickup API: yyyy-MM-dd HH:mm tt
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

/**
 * Book driver pickup for the consignment.
 * POST /v2/domestic/bookPickup
 */
export async function bookCouriersPleasePickup(input: {
  consignmentCode: string;
  readyDateTime?: string;
  totalItemCount: number;
  totalWeight: number;
  specialInstructions?: string;
}): Promise<{ jobNumber: string }> {
  if (isCouriersPleaseTestMode()) {
    const mockJob = `JOBTEST-${Date.now().toString().slice(-6)}`;
    return { jobNumber: mockJob };
  }

  const sender = couriersPleaseSenderFromEnv();
  const authHeader = getAuthHeader();

  // Next business day or today at 10:00 AM if not specified
  let readyDateTime = input.readyDateTime;
  if (!readyDateTime) {
    const d = new Date();
    // If after 2 PM, book for tomorrow 10 AM
    if (d.getHours() >= 14) {
      d.setDate(d.getDate() + 1);
    }
    // If weekend, advance to Monday
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    readyDateTime = formatPickupDateTime(d);
  }

  const payload = {
    contactName: sender.name.slice(0, 15),
    contactEmail: sender.email || "info@completehomesollution.com.au",
    readyDateTime,
    consignmentCount: 1,
    consignmentCode: input.consignmentCode,
    totalItemCount: Math.min(9999, Math.max(1, input.totalItemCount)),
    totalWeight: Math.max(0.1, Math.round(input.totalWeight * 100) / 100),
    pickup: {
      companyName: sender.name.slice(0, 19),
      address1: sender.line1.slice(0, 50),
      address2: (sender.line2 || "").slice(0, 50),
      suburb: sender.suburb,
      postcode: sender.postcode,
      phoneNumber: cleanPhone(sender.phone),
    },
    specialInstructions: (input.specialInstructions || "Ready for pickup").slice(0, 15),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v2/domestic/bookPickup`, {
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
    throw new CouriersPleaseError("Couriers Please service is unreachable while booking pickup");
  }

  const result: any = await response.json().catch(() => null);
  if (!response.ok || !result || result.responseCode !== "SUCCESS" || !result.data?.jobNumber) {
    let errorDetail = result?.msg || "Failed to book courier pickup with Couriers Please";
    if (result?.data?.errors && Array.isArray(result.data.errors) && result.data.errors.length > 0) {
      errorDetail = result.data.errors
        .map((e: any) => e.description || e.field || JSON.stringify(e))
        .filter(Boolean)
        .join(". ");
    }
    console.error("[CouriersPlease] Book pickup failed:", {
      status: response.status,
      responseCode: result?.responseCode,
      msg: result?.msg,
      errorDetail,
      data: result?.data,
    });
    throw new CouriersPleaseError(errorDetail, result?.responseCode, result?.data);
  }

  return { jobNumber: result.data.jobNumber };
}

/**
 * Get the domestic shipping label (Base64 PDF) from Couriers Please.
 * GET /v1/domestic/shipment/label?consignmentNumber=...
 */
export async function getCouriersPleaseLabel(consignmentNumber: string): Promise<string | null> {
  if (consignmentNumber.startsWith("CPTEST-") || isCouriersPleaseTestMode()) {
    return createSampleLabelPdf(consignmentNumber);
  }

  const authHeader = getAuthHeader();

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/v1/domestic/shipment/label?consignmentNumber=${encodeURIComponent(consignmentNumber)}`,
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

  const result: any = await response.json().catch(() => null);
  if (response.ok && result?.responseCode === "SUCCESS" && result.data?.label) {
    return result.data.label; // Base64 string
  }

  console.warn("[CouriersPlease] Label not yet available or failed:", result?.msg);
  return null;
}

/**
 * Fetch tracking details / events for a Couriers Please consignment.
 */
export async function getCouriersPleaseTracking(consignmentNumber: string): Promise<{
  status?: string;
  isDelivered?: boolean;
  events?: Array<{ date: string; description: string; location?: string }>;
} | null> {
  if (isCouriersPleaseTestMode() || consignmentNumber.startsWith("CPTEST-")) {
    return {
      status: "IN_TRANSIT",
      isDelivered: false,
      events: [
        { date: new Date().toISOString(), description: "Dispatched from Golden Grove warehouse (Simulation Mode)" },
      ],
    };
  }

  const authHeader = getAuthHeader();
  try {
    const response = await fetch(
      `${API_BASE}/v1/domestic/shipment/track?consignmentNumber=${encodeURIComponent(consignmentNumber)}`,
      {
        headers: { Authorization: authHeader, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) return null;
    const data: any = await response.json().catch(() => null);

    if (data?.responseCode === "SUCCESS" && data?.data) {
      const events = data.data.events || data.data.trackingEvents || [];
      const latestStatus = String(data.data.status || events[0]?.status || "").trim();
      const isDelivered = latestStatus.toLowerCase().includes("deliver") || latestStatus.toLowerCase().includes("pod");
      return { status: latestStatus, isDelivered, events };
    }
  } catch (err) {
    console.error("[CouriersPlease] Tracking query error:", err);
  }

  return null;
}

