import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Categories — Complete Home Sollution" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  let categories: Array<{ id: string; name: string; slug: string; image: string | null; _count?: { products: number } }>;
  try {
    categories = await db.category.findMany({
      include: { _count: { select: { products: { where: { isActive: true } } } } },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("[categories] Unable to load catalog", error);
    throw new Error("The catalog is temporarily unavailable.");
  }
  return (
    <main className="container mx-auto px-5 py-12">
      <h1 className="text-3xl font-black">Shop by category</h1>
      <p className="mt-2 text-muted-foreground">Browse our furniture collections by room and purpose.</p>
      {categories.length === 0 && <p className="mt-8 text-muted-foreground">No categories are available yet. Please check back soon.</p>}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map(category => (
          <Link key={category.id} href={`/categories/${category.slug}`} className="overflow-hidden rounded-2xl border bg-card hover:shadow-md transition-shadow">
            {category.image && <div className="relative aspect-[16/9]"><Image src={category.image} alt="" fill className="object-cover" /></div>}
            <div className="p-5"><h2 className="font-bold text-lg">{category.name}</h2>{category._count && <p className="text-sm text-muted-foreground">{category._count.products} products</p>}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
