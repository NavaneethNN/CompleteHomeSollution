import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// Diagnostic endpoint to check upload configuration
export async function GET() {
  const session = await auth();
  
  // Only allow admins to check this
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks = {
    R2_ACCOUNT_ID: {
      set: !!process.env.R2_ACCOUNT_ID,
      value: process.env.R2_ACCOUNT_ID ? `${process.env.R2_ACCOUNT_ID.slice(0, 4)}...` : null,
    },
    R2_BUCKET_NAME: {
      set: !!process.env.R2_BUCKET_NAME,
      value: process.env.R2_BUCKET_NAME || null,
    },
    R2_ACCESS_KEY_ID: {
      set: !!process.env.R2_ACCESS_KEY_ID,
      value: process.env.R2_ACCESS_KEY_ID ? `${process.env.R2_ACCESS_KEY_ID.slice(0, 4)}...` : null,
    },
    R2_SECRET_ACCESS_KEY: {
      set: !!process.env.R2_SECRET_ACCESS_KEY,
      value: process.env.R2_SECRET_ACCESS_KEY ? "[REDACTED]" : null,
    },
    R2_PUBLIC_URL: {
      set: !!process.env.R2_PUBLIC_URL,
      value: process.env.R2_PUBLIC_URL || null,
    },
    NODE_ENV: process.env.NODE_ENV,
  };

  const allRequiredSet = 
    checks.R2_ACCOUNT_ID.set &&
    checks.R2_BUCKET_NAME.set &&
    checks.R2_ACCESS_KEY_ID.set &&
    checks.R2_SECRET_ACCESS_KEY.set;

  const isPublicUrlConfigured = checks.R2_PUBLIC_URL.set;

  return NextResponse.json({
    status: allRequiredSet ? (isPublicUrlConfigured ? "ok" : "warning") : "error",
    message: !allRequiredSet 
      ? "Missing required R2 environment variables" 
      : !isPublicUrlConfigured 
        ? "R2_PUBLIC_URL not set - images may not display correctly in production"
        : "All upload configuration looks good",
    checks,
    recommendations: !isPublicUrlConfigured ? [
      "Set R2_PUBLIC_URL environment variable to your custom domain or public R2 URL",
      "Example: https://pub-xxx.r2.dev or https://cdn.yourdomain.com",
      "Without this, images will use the fallback URL which requires the bucket to be public",
    ] : [],
  });
}
