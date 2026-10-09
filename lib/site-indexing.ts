const fallbackOrigin = "https://completehomesollution.com.au";

export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return fallbackOrigin;
  try {
    const url = new URL(configured);
    if (!["https:", "http:"].includes(url.protocol)) return fallbackOrigin;
    return url.origin;
  } catch {
    return fallbackOrigin;
  }
}

export function indexingEnabled(): boolean {
  return process.env.SITE_INDEXING_ENABLED === "true" && process.env.NODE_ENV === "production";
}
