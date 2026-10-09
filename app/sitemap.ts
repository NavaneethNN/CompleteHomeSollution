import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { publishedBlogWhere } from "@/lib/blog-publication";
import { indexingEnabled, siteOrigin } from "@/lib/site-indexing";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingEnabled()) return [];
  const origin = siteOrigin();
  const [products, categories, posts] = await Promise.all([
    db.product.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    db.category.findMany({ where: { products: { some: { isActive: true } } }, select: { slug: true } }),
    db.blogPost.findMany({ where: { ...publishedBlogWhere(), isMemberOnly: false }, select: { slug: true, updatedAt: true } }),
  ]);
  const staticPaths = ["/", "/products", "/categories", "/blog", "/contact", "/shipping-policy", "/refund-policy", "/privacy-policy", "/terms-of-service"];
  return [
    ...staticPaths.map(path => ({ url: `${origin}${path}` })),
    ...products.map(product => ({ url: `${origin}/products/${product.slug}`, lastModified: product.updatedAt })),
    ...categories.map(category => ({ url: `${origin}/categories/${category.slug}` })),
    ...posts.map(post => ({ url: `${origin}/blog/${post.slug}`, lastModified: post.updatedAt })),
  ];
}
