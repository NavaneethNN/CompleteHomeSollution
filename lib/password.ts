import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
const VERSION = "scrypt-v1";
const COST = 131_072;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 256 * 1024 * 1024;
const LEGACY_PATTERN = /^[a-f0-9]{32}:[a-f0-9]{64}$/;

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, KEY_LENGTH, {
      N: COST, r: BLOCK_SIZE, p: PARALLELISM, maxmem: MAX_MEMORY,
    }, (error, derived) => error ? reject(error) : resolve(derived));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return [VERSION, COST, BLOCK_SIZE, PARALLELISM, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

async function verifyLegacySha256(password: string, stored: string): Promise<boolean> {
  if (!LEGACY_PATTERN.test(stored)) return false;
  const [salt, expectedHex] = stored.split(":");
  const data = new TextEncoder().encode(salt + password);
  const actual = Buffer.from(await globalThis.crypto.subtle.digest("SHA-256", data));
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function passwordNeedsRehash(stored: string): boolean {
  return !stored.startsWith(`${VERSION}$`);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    if (LEGACY_PATTERN.test(stored)) return verifyLegacySha256(password, stored);
    const [version, costText, blockText, parallelText, saltText, hashText, extra] = stored.split("$");
    if (version !== VERSION || extra !== undefined) return false;
    const cost = Number(costText);
    const blockSize = Number(blockText);
    const parallelism = Number(parallelText);
    if (cost !== COST || blockSize !== BLOCK_SIZE || parallelism !== PARALLELISM) return false;
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await derive(password, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
