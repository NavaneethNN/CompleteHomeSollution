import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function generatePresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, command, { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  });
  await r2.send(command);
}

export function getPublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/${key}`;
  }
  
  // Log warning in production if R2_PUBLIC_URL is not set
  if (process.env.NODE_ENV === "production") {
    console.warn("[R2] R2_PUBLIC_URL environment variable is not set. Images may not display correctly.");
  }
  
  // Fallback: use the R2 storage endpoint directly (works if bucket is public)
  // This requires the R2 bucket to have public access enabled
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  
  if (!accountId || !bucketName) {
    console.error("[R2] Missing R2_ACCOUNT_ID or R2_BUCKET_NAME environment variables");
    return "";
  }
  
  return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;
}

export function generateImageKey(folder: string, filename: string): string {
  const timestamp = Date.now();
  const ext = filename.split(".").pop();
  return `${folder}/${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`;
}
