/**
 * Password utilities using the Web Crypto API (globalThis.crypto.subtle).
 * Compatible with both Node.js 18+ and the Edge Runtime.
 * Format: "<16-byte-hex-salt>:<SHA-256-hex-hash>"
 */

function generateSalt(): string {
  const arr = new Uint8Array(16);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function computeSHA256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Timing-safe string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Hash a plaintext password and return a storable "<salt>:<hash>" string.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await computeSHA256(salt + password);
  return `${salt}:${hash}`;
}

/**
 * Verify a plaintext password against a stored "<salt>:<hash>" string.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const computed = await computeSHA256(salt + password);
  return timingSafeEqual(computed, expected);
}
