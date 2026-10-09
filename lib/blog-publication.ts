import type { Prisma } from "@prisma/client";

/** Public blog reads must use both publication state and its scheduled time. */
export function publishedBlogWhere(
  now = new Date()
): Prisma.BlogPostWhereInput {
  return {
    status: "PUBLISHED",
    publishedAt: { lte: now },
  };
}
