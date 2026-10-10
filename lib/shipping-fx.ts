const ECB_URL = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD+AUD.EUR.SP00.A?lastNObservations=1&format=csvdata";

let cached: { usdToAud: number; fetchedAt: number } | null = null;
let inFlight: Promise<number> | null = null;

async function loadUsdToAud(): Promise<number> {
  const response = await fetch(ECB_URL, { headers: { Accept: "text/csv" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Exchange-rate source is unavailable");
  const rows = (await response.text()).trim().split(/\r?\n/);
  const header = rows[0]?.split(",") ?? [];
  const currencyIndex = header.indexOf("CURRENCY");
  const dateIndex = header.indexOf("TIME_PERIOD");
  const valueIndex = header.indexOf("OBS_VALUE");
  if (currencyIndex < 0 || dateIndex < 0 || valueIndex < 0) throw new Error("Exchange-rate response is invalid");
  const observations = new Map<string, { date: string; value: number }>();
  for (const row of rows.slice(1)) {
    const cells = row.split(",");
    const currency = cells[currencyIndex];
    const date = cells[dateIndex];
    const value = Number(cells[valueIndex]);
    if ((currency === "USD" || currency === "AUD") && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value) && value > 0) {
      observations.set(currency, { date, value });
    }
  }
  const usd = observations.get("USD");
  const aud = observations.get("AUD");
  if (!usd || !aud || usd.date !== aud.date) throw new Error("Matching USD and AUD rates are unavailable");
  const age = Date.now() - Date.parse(`${usd.date}T00:00:00Z`);
  if (age < -86_400_000 || age > 4 * 86_400_000) throw new Error("Exchange-rate data is stale");
  const usdToAud = aud.value / usd.value;
  if (!Number.isFinite(usdToAud) || usdToAud <= 0) throw new Error("Exchange rate is invalid");
  cached = { usdToAud, fetchedAt: Date.now() };
  return usdToAud;
}

export async function usdToAudRate(): Promise<number> {
  if (cached && Date.now() - cached.fetchedAt < 60 * 60_000) return cached.usdToAud;
  if (!inFlight) inFlight = loadUsdToAud().finally(() => { inFlight = null; });
  return inFlight;
}

export async function convertShippingToAud(amount: number, currency: string): Promise<number> {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Shipping amount is invalid");
  const factor = currency === "AUD" ? 1 : currency === "USD" ? await usdToAudRate() : null;
  if (!factor) throw new Error("Ship123 returned an unsupported shipping currency");
  const cents = Math.ceil(amount * factor * 100 - 1e-9);
  if (!Number.isSafeInteger(cents) || cents > 50_000) throw new Error("Shipping amount is outside checkout limits");
  return cents / 100;
}

export function resetShippingFxCacheForTests() { cached = null; inFlight = null; }
