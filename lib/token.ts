import { randomBytes } from "crypto";
import { db } from "@/lib/db";

const TOKEN_EXPIRY_HOURS = 24;

export async function createVerificationToken(email: string): Promise<string> {
  await db.verificationToken.deleteMany({ where: { identifier: email } });

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  return token;
}

export async function consumeVerificationToken(
  token: string
): Promise<{ email: string } | { error: string }> {
  const record = await db.verificationToken.findUnique({ where: { token } });

  if (!record) {
    return { error: "Invalid or already used verification link." };
  }

  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } }).catch(() => null);
    return { error: "This verification link has expired. Please register again." };
  }

  await db.verificationToken.delete({ where: { token } }).catch(() => null);
  return { email: record.identifier };
}
