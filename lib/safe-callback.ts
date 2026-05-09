/**
 * Safe callback URL validation utility
 * Prevents open redirect vulnerabilities by validating callback URLs
 */

const ALLOWED_PATHS = [
  "/account/dashboard",
  "/account/orders",
  "/account/profile",
  "/account/addresses",
  "/account/membership",
  "/cart",
  "/checkout",
  "/",
];

const DEFAULT_CALLBACK = "/account/dashboard";

/**
 * Validates and sanitizes callback URLs to prevent open redirects
 * Only allows internal relative paths
 */
export function getSafeCallbackUrl(rawCallback: string | null): string {
  if (!rawCallback) return DEFAULT_CALLBACK;

  // Remove any whitespace
  const sanitized = rawCallback.trim();

  // Block external URLs (protocol-relative, http, https, etc.)
  if (
    sanitized.startsWith("//") || // Protocol-relative
    /^https?:\/\//i.test(sanitized) || // Absolute URLs
    sanitized.includes("://") // Any protocol
  ) {
    return DEFAULT_CALLBACK;
  }

  // Must start with /
  if (!sanitized.startsWith("/")) {
    return DEFAULT_CALLBACK;
  }

  // Block potential path traversal
  if (sanitized.includes("..") || sanitized.includes("//")) {
    return DEFAULT_CALLBACK;
  }

  // Check if it's an allowed path or starts with allowed prefix
  const isAllowed =
    ALLOWED_PATHS.includes(sanitized) ||
    ALLOWED_PATHS.some((path) => sanitized.startsWith(path + "/")) ||
    sanitized.startsWith("/account/");

  if (!isAllowed) {
    return DEFAULT_CALLBACK;
  }

  return sanitized;
}

/**
 * Get safe callback URL for login/register pages from search params
 */
export function getCallbackUrlFromSearchParams(
  searchParams: URLSearchParams
): string {
  const raw = searchParams.get("callbackUrl");
  return getSafeCallbackUrl(raw);
}
