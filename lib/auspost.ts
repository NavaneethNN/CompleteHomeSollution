const AUSPOST_API_BASE = "https://digitalapi.auspost.com.au";
const FROM_POSTCODE = process.env.AUSPOST_FROM_POSTCODE ?? "3000";

export interface AusPostRate {
  serviceCode: string;
  serviceName: string;
  price: number;
  deliveryTime: string | null;
}

interface PACService {
  code: string;
  name: string;
  price: string | number;
}

interface PACServiceResponse {
  services: {
    service: PACService | PACService[];
  };
}

interface PACCalculateResponse {
  postage_result: {
    delivery_time?: string;
    total_cost: string | number;
  };
}

function authHeaders(): Record<string, string> {
  return {
    "AUTH-KEY": process.env.AUSPOST_API_KEY ?? "",
  };
}

/**
 * Converts verbose AusPost delivery_time strings into short, readable estimates.
 * e.g. "Guaranteed Next Business Day within the Express Post network (If posted...)" → "Next business day"
 */
function formatDeliveryTime(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (lower.includes("next business day") || lower.includes("guaranteed next")) {
    return "Next business day";
  }
  // Match patterns like "Delivered in 3 business days" or "Delivered in 4-6 business days"
  const match = raw.match(/(\d+(?:-\d+)?\s+business days?)/i);
  if (match) {
    return `Delivered in ${match[1]}`;
  }
  // Match "X to Y business days"
  const rangeMatch = raw.match(/(\d+)\s+to\s+(\d+)\s+business days?/i);
  if (rangeMatch) {
    return `Delivered in ${rangeMatch[1]}–${rangeMatch[2]} business days`;
  }
  // Truncate at first parenthesis or period to remove legalese
  const trimmed = raw.split(/[(.]/)[0].trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Fetch all available domestic parcel services with prices + delivery times.
 * 1. Calls service.json to get all available services & prices in one request.
 * 2. Calls calculate.json in parallel for each service to get delivery_time.
 *
 * @param toPostcode  - Destination 4-digit AU postcode
 * @param weightKg    - Total parcel weight in kg (capped at 22 kg)
 */
export async function getDomesticParcelRates(
  toPostcode: string,
  weightKg: number
): Promise<AusPostRate[]> {
  const weight = Math.min(Math.max(weightKg, 0.1), 22);
  const dims = { length: "30", width: "30", height: "30", weight: weight.toFixed(2) };

  // Step 1: get all services + prices
  const serviceUrl = new URL(`${AUSPOST_API_BASE}/postage/parcel/domestic/service.json`);
  serviceUrl.searchParams.set("from_postcode", FROM_POSTCODE);
  serviceUrl.searchParams.set("to_postcode", toPostcode);
  Object.entries(dims).forEach(([k, v]) => serviceUrl.searchParams.set(k, v));

  const serviceRes = await fetch(serviceUrl.toString(), {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!serviceRes.ok) {
    const text = await serviceRes.text();
    throw new Error(`AusPost PAC error ${serviceRes.status}: ${text}`);
  }

  const serviceData: PACServiceResponse = await serviceRes.json();
  const raw = serviceData.services?.service;
  if (!raw) return [];

  const services: PACService[] = Array.isArray(raw) ? raw : [raw];

  // Step 2: fetch delivery_time for each service in parallel via calculate.json
  const deliveryTimes = await Promise.all(
    services.map(async (s): Promise<string | null> => {
      try {
        const calcUrl = new URL(`${AUSPOST_API_BASE}/postage/parcel/domestic/calculate.json`);
        calcUrl.searchParams.set("from_postcode", FROM_POSTCODE);
        calcUrl.searchParams.set("to_postcode", toPostcode);
        calcUrl.searchParams.set("service_code", s.code);
        Object.entries(dims).forEach(([k, v]) => calcUrl.searchParams.set(k, v));

        const calcRes = await fetch(calcUrl.toString(), {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (!calcRes.ok) return null;
        const calcData: PACCalculateResponse = await calcRes.json();
        return calcData.postage_result?.delivery_time ?? null;
      } catch {
        return null;
      }
    })
  );

  return services.map((s, i) => ({
    serviceCode: s.code,
    serviceName: s.name,
    price: parseFloat(String(s.price)),
    deliveryTime: formatDeliveryTime(deliveryTimes[i]),
  }));
}
