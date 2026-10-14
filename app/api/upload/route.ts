import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { r2, generateImageKey, getPublicUrl } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { imageUploadError, MAX_IMAGE_UPLOAD_BYTES, uploadStorageConfigurationError } from "@/lib/upload-policy";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let isAdmin = false;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized - Please sign in" }, { status: 401 });
    }
    isAdmin = session.user.role === "ADMIN";
    const limit = await consumeRateLimit("upload", `${getClientIp(req.headers)}:${session.user.id}`, 20, 60 * 60);
    if (!limit.allowed) return rateLimitResponse(limit);

    // This check cannot override the hosting limit; clients also validate before sending.
    if (Number(req.headers.get("content-length")) > MAX_IMAGE_UPLOAD_BYTES + 64 * 1024) {
      return NextResponse.json({ error: "Upload is too large. Please choose an image under 4 MB." }, { status: 413 });
    }
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid upload. Please select your image again." }, { status: 400 });
    }
    const file = formData.get("file");
    const folder = formData.get("folder") ?? "products";
    if (typeof folder !== "string" || !/^[a-zA-Z0-9_-]+$/.test(folder)) {
      return NextResponse.json({ error: "Invalid upload folder" }, { status: 400 });
    }
    if (!isAdmin && !["reviews", "profile"].includes(folder)) {
      return NextResponse.json({ error: "Unauthorized folder for non-admin users" }, { status: 403 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }
    const validationError = imageUploadError(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: file.size > MAX_IMAGE_UPLOAD_BYTES ? 413 : 400 });
    }
    const configError = uploadStorageConfigurationError(process.env);
    if (configError) {
      console.error("[Upload]", configError);
      return NextResponse.json({ error: isAdmin ? configError : "Image uploads are temporarily unavailable. Please contact support." }, { status: 503 });
    }
    const key = generateImageKey(folder, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!, Key: key, Body: buffer,
      ContentType: file.type, ContentLength: buffer.length,
    }));
    return NextResponse.json({ key, publicUrl: getPublicUrl(key) });
  } catch (error) {
    console.error("[POST /api/upload]", error);
    const code = error instanceof Error ? error.name : "";
    const providerStatus = (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;
    const credentialsRejected = ["Unauthorized", "AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch", "CredentialsProviderError"].includes(code)
      || providerStatus === 401 || providerStatus === 403
      || (error instanceof Error && error.message === "Unauthorized");
    const message = isAdmin && credentialsRejected
      ? "Image storage rejected the upload credentials. Check the R2 access keys and bucket write permissions in Vercel, then redeploy."
      : isAdmin && code === "NoSuchBucket"
        ? "The image storage bucket was not found. Check R2_BUCKET_NAME and R2_ACCOUNT_ID in Vercel."
        : "Image upload failed. Please try again. If it continues, contact support.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
