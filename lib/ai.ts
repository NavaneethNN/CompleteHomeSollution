import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";

export const embeddingModel = openai.embedding("text-embedding-3-small");

export async function generateEmbedding(text: string): Promise<number[]> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });

  return response.data[0].embedding;
}

export async function getSimilarProducts(
  productId: string,
  limit = 4
): Promise<{ id: string; name: string; slug: string; price: number; images: string[] }[]> {
  const results = await db.$queryRaw<
    { id: string; name: string; slug: string; price: number; images: string[] }[]
  >`
    SELECT id, name, slug, price, images
    FROM "Product"
    WHERE id != ${productId}
      AND embedding IS NOT NULL
      AND "isActive" = true
    ORDER BY embedding <=> (
      SELECT embedding FROM "Product" WHERE id = ${productId}
    )
    LIMIT ${limit}
  `;

  return results;
}

export async function getRecommendationsForUser(
  userId: string,
  limit = 4
): Promise<{ id: string; name: string; slug: string; price: number; images: string[] }[]> {
  const results = await db.$queryRaw<
    { id: string; name: string; slug: string; price: number; images: string[] }[]
  >`
    SELECT p.id, p.name, p.slug, p.price, p.images
    FROM "Product" p
    WHERE p."isActive" = true
      AND p.embedding IS NOT NULL
      AND p.id NOT IN (
        SELECT oi."productId"
        FROM "OrderItem" oi
        JOIN "Order" o ON oi."orderId" = o.id
        WHERE o."userId" = ${userId}
      )
    ORDER BY p.embedding <=> (
      SELECT AVG(p2.embedding)
      FROM "Product" p2
      JOIN "OrderItem" oi ON p2.id = oi."productId"
      JOIN "Order" o ON oi."orderId" = o.id
      WHERE o."userId" = ${userId}
        AND p2.embedding IS NOT NULL
    )
    LIMIT ${limit}
  `;

  return results;
}
