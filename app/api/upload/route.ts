import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generatePresignedUrl, generateImageKey } from "@/lib/r2";
import { z } from "zod";

const uploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().regex(/^image\/(jpeg|png|webp|avif|gif)$/),
  folder: z.string().default("products"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { filename, contentType, folder } = uploadSchema.parse(body);

    const key = generateImageKey(folder, filename);
    const uploadUrl = await generatePresignedUrl(key, contentType);

    return NextResponse.json({ uploadUrl, key });
  } catch (error) {
    console.error("[POST /api/upload]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
