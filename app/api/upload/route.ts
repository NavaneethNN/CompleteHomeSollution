import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { r2, generateImageKey, getPublicUrl } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const config = {
  api: { bodyParser: false },
};

// Raise Next.js body size limit for file uploads
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    console.log("[Upload] Starting upload request");
    
    const session = await auth();
    console.log("[Upload] Session:", session?.user?.id ? `User ${session.user.id}` : "No session");
    
    // Allow authenticated users to upload images (for reviews, profile pictures)
    // Admins can upload for products
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized - Please sign in" }, { status: 401 });
    }
    
    const isAdmin = session.user.role === "ADMIN";
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string | null) ?? "products";
    
    console.log(`[Upload] File: ${file?.name}, Folder: ${folder}, Admin: ${isAdmin}`);
    
    // Non-admin users can only upload to specific folders
    if (!isAdmin && !["reviews", "profile"].includes(folder)) {
      return NextResponse.json({ error: "Unauthorized folder for non-admin users" }, { status: 403 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 400 });
    }

    const key = generateImageKey(folder, file.name);
    console.log(`[Upload] Generated key: ${key}`);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`[Upload] Buffer size: ${buffer.length} bytes`);

    console.log(`[Upload] Uploading to R2 bucket: ${process.env.R2_BUCKET_NAME}`);
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ContentLength: buffer.length,
      })
    );
    console.log(`[Upload] R2 upload successful`);

    const publicUrl = getPublicUrl(key);
    console.log(`[Upload] Generated public URL: ${publicUrl}`);
    
    // Validate the public URL was generated
    if (!publicUrl) {
      return NextResponse.json(
        { error: "Failed to generate public URL. Check R2 environment variables." },
        { status: 500 }
      );
    }
    
    console.log(`[Upload] Successfully uploaded ${key} to ${publicUrl}`);
    
    return NextResponse.json({ key, publicUrl });
  } catch (error) {
    console.error("[POST /api/upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
