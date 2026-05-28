import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { CategorySlider } from "@/components/shop/category-slider";
import { HomeTrendingProductCard } from "@/components/shop/home-trending-product-card";
import { fallbackCategories, fallbackProducts } from "@/lib/data/fallback-shop-data";
import {
  ArrowRight,
  Award, Truck, ShieldCheck, Headphones,
  RotateCcw, BadgeCheck, Tag, Leaf,
  Star,
} from "lucide-react";

export const metadata: Metadata = { title: "Home — Complete Home Sollution" };

/* ─── Data ─────────────────────────────────────────────────────────── */

const FEATURES = [
  { icon: Award,       title: "Premium Quality",  sub: "Crafted with high quality materials" },
  { icon: Truck,       title: "Fast Delivery",     sub: "Quick & reliable delivery at your doorstep" },
  { icon: ShieldCheck, title: "Secure Payment",    sub: "100% secure payment guarantee" },
  { icon: Headphones,  title: "24/7 Support",      sub: "Dedicated support whenever you need" },
];


const TRUST = [
  { icon: RotateCcw,   title: "7 Days Easy Returns",      sub: "Hassle-free returns" },
  { icon: BadgeCheck,  title: "Warranty Protection",       sub: "Long-term assurance" },
  { icon: Tag,         title: "Best Price Guarantee",      sub: "Unbeatable prices" },
  { icon: Leaf,        title: "Sustainable Materials",     sub: "Eco-friendly & safe" },
];

/* ─── Data Fetching ─────────────────────────────────────────────────── */

async function getCategories() {
  try {
    const categories = await db.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });

    return categories.length > 0 ? categories : fallbackCategories;
  } catch {
    return fallbackCategories;
  }
}

async function getTrendingProducts() {
  try {
    const products = await db.product.findMany({
      where: { isActive: true },
      include: {
        category: { select: { name: true, slug: true } },
        productVariants: {
          where: { isActive: true },
          include: { 
            images: { take: 1, orderBy: { displayOrder: "asc" } },
            values: {
              include: {
                variantValue: true,
              },
            },
          },
          orderBy: { price: "asc" },
          take: 1,
        },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    });

    if (products.length === 0) {
      return fallbackProducts.slice(0, 4).map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.basePrice,
        originalPrice: p.comparePrice ?? p.basePrice,
        discount: p.comparePrice && p.comparePrice > p.basePrice
          ? `-${Math.round(((p.comparePrice - p.basePrice) / p.comparePrice) * 100)}%`
          : null,
        rating: 4.5,
        reviews: p.reviewCount,
        img: p.images[0],
        description: p.description,
        memberPrice: p.memberPrice,
        stock: p.stock,
        category: p.category,
      }));
    }

    return products.map((p) => {
      const variant = p.hasVariants && p.productVariants[0] ? p.productVariants[0] : null;
      const price = variant?.price ?? p.basePrice;
      const comparePrice = variant?.comparePrice ?? p.comparePrice;
      const image = variant?.images[0]?.url ?? p.images[0];
      const stock = variant?.stock ?? p.stock; // Use variant stock if available

      // Generate variant label from variant attribute values if available
      const variantLabel = variant?.values
        ?.map((v: { variantValue: { value: string } }) => v.variantValue.value)
        .join(" / ");

      const discount = comparePrice && comparePrice > price 
        ? `-${Math.round(((comparePrice - price) / comparePrice) * 100)}%`
        : null;

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price,
        originalPrice: comparePrice || price,
        discount,
        rating: 4.5, // Could be calculated from reviews
        reviews: p._count.reviews,
        variantId: variant?.id ?? null,
        sku: variant?.sku ?? p.sku,
        variantLabel,
        hasVariants: p.hasVariants,
        img: image,
        description: p.description,
        memberPrice: variant?.memberPrice ?? p.memberPrice,
        stock,
        category: p.category,
      };
    });
  } catch {
    return fallbackProducts.slice(0, 4).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.basePrice,
      originalPrice: p.comparePrice ?? p.basePrice,
      discount: p.comparePrice && p.comparePrice > p.basePrice
        ? `-${Math.round(((p.comparePrice - p.basePrice) / p.comparePrice) * 100)}%`
        : null,
      rating: 4.5,
      reviews: p.reviewCount,
      img: p.images[0],
      description: p.description,
      memberPrice: p.memberPrice,
      stock: p.stock,
      category: p.category,
    }));
  }
}

/* ─── Sub-components ────────────────────────────────────────────────── */

interface SectionHeadingProps {
  readonly tag: string;
  readonly title: string;
}

function SectionHeading({ tag, title }: SectionHeadingProps) {
  return (
    <div className="text-center mb-10">
      <p className="text-sm font-semibold tracking-widest text-primary uppercase mb-2">{tag}</p>
      <h2 className="text-3xl md:text-4xl font-black text-foreground mb-3">{title}</h2>
      <div className="flex items-center justify-center gap-1.5">
        <span className="w-8 h-[3px] rounded-full bg-primary" />
        <span className="w-3 h-[3px] rounded-full bg-border" />
      </div>
    </div>
  );
}

interface StarRatingProps {
  readonly rating: number;
  readonly count: number;
}

function StarRating({ rating, count }: StarRatingProps) {
  const starClassName = (value: number) => {
    if (value <= Math.floor(rating)) return "fill-amber-400 text-amber-400";
    if (value - 0.5 <= rating) return "fill-amber-400/50 text-amber-400";
    return "text-muted-foreground/30";
  };

  const stars = [1, 2, 3, 4, 5].map((value) => (
    <Star key={value} className={`h-3.5 w-3.5 ${starClassName(value)}`} />
  ));

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <div className="flex">{stars}</div>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default async function HomePage() {
  const session = await auth();
  const [trendingProducts, categories, dbUser] = await Promise.all([
    getTrendingProducts(),
    getCategories(),
    session?.user?.id
      ? db.user.findUnique({ where: { id: session.user.id }, select: { isMember: true } })
      : Promise.resolve(null),
  ]);
  const isMember = dbUser?.isMember ?? false;

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white min-h-[520px] md:min-h-[600px] flex items-center">
        {/* Mobile background image */}
        <div className="absolute inset-0 lg:hidden">
          <Image
            src="/hero_bg.webp"
            alt=""
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-white/85" />
        </div>

        {/* Text column */}
        <div className="container mx-auto px-5 md:px-6 xl:px-8 relative z-10">
          <div className="max-w-[520px] py-8 md:py-16 lg:py-20">
            <p className="text-[11px] md:text-xs font-semibold tracking-[0.25em] text-muted-foreground uppercase mb-3 md:mb-4">
              MAKE YOUR HOUSE A
            </p>
            <h1 className="text-[42px] md:text-6xl xl:text-[72px] font-black leading-[1.05] text-foreground">
              Complete
            </h1>
            <h1 className="text-[42px] md:text-6xl xl:text-[72px] font-black leading-[1.05] text-foreground mb-2">
              Comfort
            </h1>
            <p className="text-2xl md:text-4xl font-script text-primary italic mb-4 md:mb-5 leading-snug">
              Live Beautifully
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-7 md:mb-8 max-w-[380px]">
              Discover premium quality furniture that combines elegance, comfort and functionality.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-7 py-3.5 rounded-lg transition-colors shadow-md w-full sm:w-auto"
              >
                SHOP NOW <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 border border-foreground/30 text-foreground hover:bg-foreground hover:text-white font-bold text-sm px-7 py-3.5 rounded-lg transition-colors w-full sm:w-auto"
              >
                EXPLORE COLLECTION
              </Link>
            </div>
          </div>
        </div>

        {/* Hero image — right side, edge-to-edge (desktop only) */}
        <div className="absolute inset-y-0 right-0 hidden lg:block w-[58%]">
          <Image
            src="/hero_bg.webp"
            alt="Modern living room with premium furniture"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-white via-white/60 to-transparent" />
        </div>
      </section>

      {/* ── Features bar ──────────────────────────────────────────── */}
      <section className="bg-white border-y border-border py-6 md:py-8 shadow-sm">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-4">
            {FEATURES.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex items-center gap-3 md:gap-4">
                <div className="w-9 h-9 md:w-11 md:h-11 rounded-full border-2 border-primary/20 bg-primary/5 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] md:text-sm font-bold text-foreground leading-tight">{title}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 leading-snug">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Shop By Category ──────────────────────────────────────── */}
      <section className="py-10 md:py-16 bg-white">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <SectionHeading tag="BROWSE BY CATEGORY" title="Shop By Category" />
          <CategorySlider categories={categories} />
        </div>
      </section>

      {/* ── Promo Banners ─────────────────────────────────────────── */}
      <section className="py-4 pb-10 md:pb-16">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">

            {/* Dark card — Custom Furniture */}
            <div className="relative rounded-2xl overflow-hidden bg-navy min-h-[220px] md:min-h-[260px] flex items-center p-6 md:p-10">
              <div className="relative z-10 max-w-[260px]">
                <p className="text-xs font-bold tracking-widest text-primary uppercase mb-3">
                  — CUSTOM FURNITURE
                </p>
                <h3 className="text-3xl font-black text-white leading-tight mb-3">
                  Designed Just<br />For You
                </h3>
                <p className="text-sm text-white/60 mb-6 leading-relaxed">
                  Personalised furniture to match your style and space.
                </p>
                <Link
                  href="/products"
                  className="inline-block bg-primary hover:bg-primary/90 text-white font-bold text-sm px-6 py-3 rounded transition-colors"
                >
                  GET STARTED
                </Link>
              </div>
              {/* Chair image */}
              <div className="absolute right-0 bottom-0 h-full w-[55%] hidden sm:block">
                <Image
                  src="https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=600&q=80"
                  alt="Custom armchair"
                  fill
                  className="object-cover object-top opacity-80"
                />
                <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-navy to-transparent" />
              </div>
            </div>

            {/* Light card — Special Offer */}
            <div className="relative rounded-2xl overflow-hidden bg-secondary min-h-[260px] flex items-center p-8 md:p-10">
              <div className="relative z-10">
                <p className="text-xs font-bold tracking-widest text-primary uppercase mb-3">
                  — SPECIAL OFFER
                </p>
                <h3 className="text-4xl font-black text-foreground leading-tight mb-1">
                  Up to 30% Off
                </h3>
                <p className="text-base font-semibold text-foreground/70 mb-6">
                  on Selected Items
                </p>
                <Link
                  href="/products"
                  className="inline-block bg-primary hover:bg-primary/90 text-white font-bold text-sm px-6 py-3.5 rounded transition-colors"
                >
                  SHOP NOW
                </Link>
              </div>
              {/* 30% OFF badge */}
              <div className="absolute top-6 right-6 w-16 h-16 bg-primary rounded-full flex flex-col items-center justify-center text-white shadow-lg z-20">
                <span className="text-lg font-black leading-none">30%</span>
                <span className="text-[9px] font-bold tracking-widest">OFF</span>
              </div>
              {/* Sideboard image */}
              <div className="absolute right-0 bottom-0 h-full w-[50%] hidden sm:block">
                <Image
                  src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80"
                  alt="Special offer furniture"
                  fill
                  className="object-cover object-center opacity-90"
                />
                <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-secondary to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Popular Products ──────────────────────────────────────── */}
      <section className="py-4 pb-14 md:pb-20 bg-white">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <SectionHeading tag="TRENDING PRODUCTS" title="Popular Picks For You" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            {trendingProducts.map((p) => (
              <HomeTrendingProductCard key={p.id} product={p} isMember={isMember} />
            ))}
          </div>

          {/* View all */}
          <div className="text-center mt-10">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white font-bold text-sm px-8 py-3.5 rounded transition-colors"
            >
              VIEW ALL PRODUCTS <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust Bar ─────────────────────────────────────────────── */}
      <section className="bg-slate-100 py-6 md:py-8 border-t border-slate-200">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {TRUST.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full border border-primary/20 bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 leading-tight">{title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
