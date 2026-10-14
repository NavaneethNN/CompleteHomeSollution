// Leave room for multipart headers below Vercel's 4.5 MB request limit.
export const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024;
export const IMAGE_UPLOAD_LIMIT_LABEL = "4 MB";
export const IMAGE_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export function imageUploadError(file: { size: number; type: string }): string | null {
  if (!IMAGE_UPLOAD_TYPES.includes(file.type)) return "Use a JPEG, PNG, WebP, AVIF, or GIF image.";
  if (file.size === 0) return "The image file is empty. Please choose another image.";
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) return "Image exceeds 4 MB. Please resize or compress it and try again.";
  return null;
}

export function uploadStorageConfigurationError(env: Record<string, string | undefined>): string | null {
  const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"];
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) return `Image storage is not configured. Set ${missing.join(", ")} in Vercel and redeploy.`;
  try {
    const url = new URL(env.R2_PUBLIC_URL!);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.hostname.endsWith(".r2.cloudflarestorage.com")) throw new Error();
  } catch {
    return "R2_PUBLIC_URL must be the HTTPS public bucket URL or custom image domain, not the R2 storage API endpoint.";
  }
  return null;
}
