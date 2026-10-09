/**
 * Returns a tracking link only for courier names we recognise. This avoids
 * turning administrator-entered text into an arbitrary external URL.
 */
export function getTrackingUrl(carrier: string | null | undefined, trackingNumber: string): string | null {
  const courier = carrier?.trim().toLowerCase() ?? "";
  const trackingId = encodeURIComponent(trackingNumber.trim());

  if (!trackingId) return null;
  if (courier.includes("australia post") || courier.includes("auspost")) {
    return `https://auspost.com.au/mypost/track/#/details/${trackingId}`;
  }
  if (courier.includes("startrack")) {
    return `https://startrack.com.au/track/search?trackingNumber=${trackingId}`;
  }
  if (courier.includes("dhl")) {
    return `https://www.dhl.com/au-en/home/tracking.html?tracking-id=${trackingId}`;
  }
  if (courier.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${trackingId}`;
  }

  return null;
}
