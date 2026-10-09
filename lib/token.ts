import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const TOKEN_EXPIRY_HOURS = 24;
const VERIFY_PREFIX = "verify:";
const RESET_PREFIX = "password-reset:";

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function createToken(identifier: string, expiryHours: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.verificationToken.deleteMany({ where: { identifier } });
  await db.verificationToken.create({
    data: { identifier, token: digest(token), expires: new Date(Date.now() + expiryHours * 60 * 60 * 1000) },
  });
  return token;
}

export async function createVerificationToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  await db.verificationToken.deleteMany({ where: { identifier: normalized } }); // remove legacy token
  return createToken(`${VERIFY_PREFIX}${normalized}`, TOKEN_EXPIRY_HOURS);
}

export async function consumeVerificationToken(
  token: string
): Promise<{ email: string } | { error: string }> {
  return db.$transaction(async tx => {
    const record = await tx.verificationToken.findFirst({ where: { token: { in: [digest(token), token] } } });
    if (!record || (record.identifier.startsWith(RESET_PREFIX))) return { error: "Invalid or already used verification link." };
    const claimed = await tx.verificationToken.deleteMany({ where: { token: record.token } });
    if (!claimed.count) return { error: "Invalid or already used verification link." };
    if (record.expires < new Date()) return { error: "This verification link has expired. Please request a new one." };
    const email = record.identifier.startsWith(VERIFY_PREFIX) ? record.identifier.slice(VERIFY_PREFIX.length) : record.identifier;
    const user = await tx.user.findUnique({ where: { email } });
    if (!user) return { error: "This verification link is no longer valid." };
    if (!user.emailVerified) await tx.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    return { email };
  });
}

export async function createPasswordResetToken(email: string): Promise<string> {
  return createToken(`${RESET_PREFIX}${email.trim().toLowerCase()}`, 1);
}

export async function revokeToken(token: string): Promise<void> {
  await db.verificationToken.deleteMany({ where: { token: { in: [digest(token), token] } } });
}

export async function resetPasswordWithToken(token: string, password: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return db.$transaction(async tx => {
    const record = await tx.verificationToken.findFirst({ where: { token: { in: [digest(token), token] }, identifier: { startsWith: RESET_PREFIX } } });
    if (!record || record.expires < new Date()) {
      if (record) await tx.verificationToken.deleteMany({ where: { token: record.token } });
      return false;
    }
    const claimed = await tx.verificationToken.deleteMany({ where: { token: record.token } });
    if (!claimed.count) return false;
    const updated = await tx.user.updateMany({ where: { email: record.identifier.slice(RESET_PREFIX.length) }, data: { passwordHash } });
    return updated.count === 1;
  });
}
