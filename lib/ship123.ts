import type { ParcelGroup } from "@/lib/shipping-packages";

const API_BASE = "https://api.ship123.com";

export type Ship123Address = {
  name: string;
  line1: string;
  line2?: string | null;
  suburb: string;
  state: string;
  postcode: string;
  phone?: string | null;
  email?: string | null;
};

export function ship123SenderFromEnv(): Ship123Address {
  const names = ["SHIP123_SENDER_NAME", "SHIP123_SENDER_SUBURB", "SHIP123_SENDER_STATE", "SHIP123_SENDER_POSTCODE", "SHIP123_SENDER_PHONE"] as const;
  const values = names.map(name => process.env[name]?.trim());
  const street = process.env.SHIP123_SENDER_LINE1?.trim() || process.env.SHIP123_SENDER_STREET?.trim();
  if (!street || values.some(value => !value) || !/^\d{4}$/.test(values[3] ?? "") ||
      !/^(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)$/.test(values[2] ?? "")) {
    throw new Ship123Error("Ship123 sender address is not configured");
  }
  return {
    name: values[0]!, line1: street, suburb: values[1]!, state: values[2]!, postcode: values[3]!, phone: values[4]!,
    line2: process.env.SHIP123_SENDER_LINE2?.trim() || undefined,
    email: process.env.SHIP123_SENDER_EMAIL?.trim() || undefined,
  };
}

export type Ship123Rate = {
  serviceCode: string;
  serviceName: string;
  price: number;
  deliveryTime: null;
};

export class Ship123Error extends Error {
  constructor(message: string, readonly code?: string, readonly traceId?: string) {
    super(message);
  }
}

function apiSecret(): string {
  const secret = process.env.SHIP_123_API_KEY?.trim() || process.env.SHIP123_API_KEY?.trim() || process.env.SHIP123_API_SECRET?.trim();
  if (!secret) throw new Ship123Error("Ship123 API key is not configured");
  return secret;
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const secret = apiSecret();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Api-Secret": secret, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Ship123Error("Ship123 is currently unreachable");
  }
  const result: unknown = await response.json().catch(() => null);
  if (!result || typeof result !== "object") throw new Ship123Error("Ship123 returned an invalid response");
  const envelope = result as { success?: unknown; code?: unknown; msg?: unknown; traceId?: unknown; data?: unknown };
  const code = typeof envelope.code === "string" ? envelope.code : undefined;
  const traceId = typeof envelope.traceId === "string" ? envelope.traceId : undefined;
  if (!response.ok || envelope.success !== true) {
    // Provider messages may contain customer addresses. Keep them in server logs only.
    console.error("[Ship123] API request failed", { path, httpStatus: response.status, code, traceId, message: envelope.msg });
    throw new Ship123Error("Ship123 could not complete the request", code, traceId);
  }
  return envelope.data as T;
}

type Product = { productCode?: unknown; productName?: unknown; customCarrier?: unknown };
const SERVICE_NAMES: Record<string, string> = {
  AU_POST_EPARCEL: "Australia Post eParcel",
  AU_POST_EXPRESS: "Australia Post Express",
  AU_POST_STANDARD: "Australia Post Standard",
};

export async function getEligibleShip123Products(): Promise<Array<{ code: string; name: string; carrier: string }>> {
  const data = await request<unknown>("/ship-order/openApi/logistics/product/list", {});
  if (!Array.isArray(data)) throw new Ship123Error("Ship123 product list is invalid");
  return (data as Product[]).flatMap(product => {
    const code = product.productCode;
    if (typeof code !== "string" || !/^[A-Z0-9_-]{1,50}$/.test(code) || code === "AUTO_LOWEST_PRICE") return [];
    // customCarrier is returned by some accounts but is not part of the published schema.
    const suppliedCarrier = typeof product.customCarrier === "string" ? product.customCarrier.trim() : "";
    const carrier = suppliedCarrier || (Object.hasOwn(SERVICE_NAMES, code) ? "AUSTRALIA POST" : "");
    if (!carrier || /^(?:other|auto|unknown)$/i.test(carrier)) return [];
    const providerName = typeof product.productName === "string" ? product.productName.trim() : "";
    return [{ code, name: (providerName && providerName !== code ? providerName : SERVICE_NAMES[code]) || providerName || code.replaceAll("_", " "), carrier }];
  });
}

function toProviderAddress(address: Ship123Address) {
  return {
    contactName: address.name,
    addressFirst: address.line1,
    ...(address.line2 ? { addressSecond: address.line2 } : {}),
    cityName: address.suburb,
    stateOrProvince: address.state,
    postalCode: address.postcode,
    countryRegionCode: "AU",
    ...(address.phone ? { contactPhone: address.phone } : {}),
    ...(address.email ? { contactEmail: address.email } : {}),
  };
}

type Quote = { productCode?: unknown; productName?: unknown; totalPrice?: unknown; currencyCode?: unknown };

export async function calculateShip123Rate(code: string, destination: Ship123Address, groups: ParcelGroup[]): Promise<{
  code: string; name: string; amount: number; currency: string;
}> {
  const data = await request<Quote>("/ship-order/openApi/order/calculate", {
    bsFlag: 0,
    productCode: code,
    shipFrom: toProviderAddress(ship123SenderFromEnv()),
    shipTo: toProviderAddress(destination),
    packageList: groups.map(group => ({
      quantity: group.count, length: group.lengthCm, width: group.widthCm,
      height: group.heightCm, weight: group.weightKg,
    })),
  });
  const amount = data?.totalPrice;
  const currency = data?.currencyCode;
  if (data?.productCode !== code || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 ||
      typeof currency !== "string") throw new Ship123Error("Ship123 returned an invalid freight quote");
  return { code, name: typeof data.productName === "string" ? data.productName : code, amount, currency };
}

export async function getShip123Rates(destination: Ship123Address, groups: ParcelGroup[]): Promise<Ship123Rate[]> {
  if (!groups.length) return [];
  // Validate before per-service error handling so configuration failures stay actionable.
  ship123SenderFromEnv();
  const products = await getEligibleShip123Products();
  if (!products.length) throw new Ship123Error("No named shipping services are enabled in Ship123");
  const { convertShippingToAud } = await import("@/lib/shipping-fx");
  const rates: Ship123Rate[] = [];
  // Ship123 can throttle concurrent freight calculations. Quote named services
  // one at a time and retry only its explicit temporary throttle response.
  for (const product of products) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const quote = await calculateShip123Rate(product.code, destination, groups);
        rates.push({
          serviceCode: product.code,
          serviceName: product.name,
          price: await convertShippingToAud(quote.amount, quote.currency),
          deliveryTime: null,
        });
        break;
      } catch (error) {
        if (!(error instanceof Ship123Error) || error.code !== "1000004" || attempt === 2) break;
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }
  if (!rates.length) throw new Ship123Error("No Ship123 shipping rate is available for this address and package");
  return rates.sort((a, b) => a.price - b.price);
}

export async function createShip123Order(input: {
  customerOrderNo: string;
  productCode: string;
  sender: Ship123Address;
  recipient: Ship123Address;
  packages: Array<{ quantity: number; length: number; width: number; height: number; weight: number;
    skuList: Array<{ sku?: string; nameEn: string; quantity: number; declaredValue: number; productType: 1; originCountryCode?: string }> }>;
}): Promise<string> {
  const data = await request<{ orderNo?: unknown }>("/ship-order/openApi/order/create", {
    bsFlag: 0, customerOrderNo: input.customerOrderNo, productCode: input.productCode,
    declaredCurrency: "AUD", shipFrom: toProviderAddress(input.sender), shipTo: toProviderAddress(input.recipient),
    packageList: input.packages,
  });
  if (typeof data?.orderNo !== "string" || !data.orderNo) throw new Ship123Error("Ship123 did not return an order number");
  return data.orderNo;
}

export type Ship123OrderDetail = {
  orderNo?: string; customerOrderNo?: string; orderStatus?: number; productCode?: string;
  trackNo?: string; waybillNo?: string; labelFile?: { labelUrl?: string };
  packageList?: Array<{ labelFile?: { labelUrl?: string } }>;
};

export async function getShip123OrderDetail(orderNo: string): Promise<Ship123OrderDetail> {
  const data = await request<Ship123OrderDetail>("/ship-order/openApi/order/detail", { orderNo });
  if (data?.orderNo !== orderNo) throw new Ship123Error("Ship123 order detail reference did not match");
  return data;
}

export function ship123LabelUrl(detail: Ship123OrderDetail): string | null {
  const candidates = [detail.labelFile?.labelUrl, ...(detail.packageList ?? []).map(item => item.labelFile?.labelUrl)];
  const valid = candidates.find(value => {
    if (!value || !URL.canParse(value)) return false;
    return new URL(value).protocol === "https:";
  });
  return valid ?? null;
}
