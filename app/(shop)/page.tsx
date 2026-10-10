import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/membership";
import { CategorySlider } from "@/components/shop/category-slider";
import { HomeTrendingProductCard } from "@/components/shop/home-trending-product-card";
import { AnimateIn } from "@/components/shared/animate-in";
import { fallbackCategories, fallbackProducts } from "@/lib/data/fallback-shop-data";
import {
  ArrowRight,
  Award,
  Truck,
  ShieldCheck,
  Headphones,
  RotateCcw,
  BadgeCheck,
  Tag,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = { title: "Home — Complete Home Sollution" };

const FEATURES = [
  { icon: Award,       title: "Considered design", sub: "Pieces for real homes" },
  { icon: Truck,       title: "Australia-wide",   sub: "Delivery options at checkout" },
  { icon: ShieldCheck, title: "Secure checkout",  sub: "Protected payment" },
  { icon: Headphones,  title: "Here to help",     sub: "Questions? Get in touch" },
];

const WHY_US = [
  {
    icon: Award,
    title: "Furniture with purpose",
    desc: "Find practical pieces that bring comfort and character to the rooms you use every day.",
  },
  {
    icon: Truck,
    title: "Delivery across Australia",
    desc: "Enter your address at checkout to see the shipping options available for your order.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payments",
    desc: "Check out through our secure payment provider with clear pricing before you pay.",
  },
  {
    icon: RotateCcw,
    title: "Shop with clarity",
    desc: "Review product details, prices and delivery options before placing your order.",
  },
  {
    icon: BadgeCheck,
    title: "Support when you need it",
    desc: "Our team can help you find the right piece for your space.",
  },
  {
    icon: Tag,
    title: "Member savings",
    desc: "Members can access special prices on eligible pieces and free shipping.",
  },
];

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
            values: { include: { variantValue: true } },
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
        id: p.id, name: p.name, slug: p.slug, price: p.basePrice,
        originalPrice: p.comparePrice ?? p.basePrice,
        discount: p.comparePrice && p.comparePrice > p.basePrice
          ? `-${Math.round(((p.comparePrice - p.basePrice) / p.comparePrice) * 100)}%` : null,
        reviews: p.reviewCount, img: p.images[0], description: p.description,
        memberPrice: p.memberPrice, stock: p.stock, category: p.category,
      }));
    }

    return products.map((p) => {
      const variant = p.hasVariants && p.productVariants[0] ? p.productVariants[0] : null;
      const price = variant?.price ?? p.basePrice;
      const comparePrice = variant?.comparePrice ?? p.comparePrice;
      const image = variant?.images[0]?.url ?? p.images[0];
      const stock = variant?.stock ?? p.stock;
      const variantLabel = variant?.values
        ?.map((v: { variantValue: { value: string } }) => v.variantValue.value)
        .join(" / ");
      const discount = comparePrice && comparePrice > price
        ? `-${Math.round(((comparePrice - price) / comparePrice) * 100)}%` : null;
      return {
        id: p.id, name: p.name, slug: p.slug, price, originalPrice: comparePrice || price,
        discount, reviews: p._count.reviews, variantId: variant?.id ?? null,
        sku: variant?.sku ?? p.sku, variantLabel, hasVariants: p.hasVariants, img: image,
        description: p.description, memberPrice: variant?.memberPrice ?? p.memberPrice,
        stock, category: p.category,
      };
    });
  } catch {
    return fallbackProducts.slice(0, 4).map((p) => ({
      id: p.id, name: p.name, slug: p.slug, price: p.basePrice,
      originalPrice: p.comparePrice ?? p.basePrice,
      discount: p.comparePrice && p.comparePrice > p.basePrice
        ? `-${Math.round(((p.comparePrice - p.basePrice) / p.comparePrice) * 100)}%` : null,
      reviews: p.reviewCount, img: p.images[0], description: p.description,
      memberPrice: p.memberPrice, stock: p.stock, category: p.category,
    }));
  }
}

async function getMemberStatus(userId?: string) {
  if (!userId) return false;

  try {
    const membership = await db.user.findUnique({
      where: { id: userId },
      select: { isMember: true, membershipExpiry: true },
    });
    return hasActiveMembership(membership);
  } catch {
    // Public storefront pages remain available when the database is offline.
    return false;
  }
}

interface SectionHeadingProps { readonly tag: string; readonly title: string; }
function SectionHeading({ tag, title }: SectionHeadingProps) {
  return (
    <div className="mb-7 md:mb-10">
      <p className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-2">{tag}</p>
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">{title}</h2>
    </div>
  );
}

export default async function HomePage() {
  const session = await auth();
  const [trendingProducts, categories, isMember] = await Promise.all([
    getTrendingProducts(),
    getCategories(),
    getMemberStatus(session?.user?.id),
  ]);

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="bg-[#f7f3ed] overflow-hidden">
        <div className="mx-auto grid max-w-[1500px] lg:min-h-[590px] lg:grid-cols-[46%_54%]">
          <div className="flex items-center px-5 pb-7 pt-10 sm:px-8 sm:py-14 lg:px-12 xl:px-20">
            <div className="max-w-[540px]">
              <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                <span className="h-px w-7 bg-primary" /> Furniture for the way you live
              </p>
              <h1 className="max-w-[10ch] text-[clamp(2.8rem,10vw,4.2rem)] font-semibold leading-[1.04] tracking-[-0.055em] text-foreground lg:text-[clamp(3.8rem,5vw,5.6rem)]">
                Make room for better living.
              </h1>
              <p className="mt-5 max-w-[440px] text-[15px] leading-7 text-muted-foreground sm:text-base">
                Thoughtfully chosen furniture for the spaces that make a house feel like home.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Link href="/products" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-white transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  Explore furniture <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/categories" className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-foreground underline decoration-primary/50 underline-offset-8 hover:text-primary">
                  Shop by room <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <p className="mt-8 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Truck className="h-4 w-4 text-primary" /> Delivery options across Australia</p>
            </div>
          </div>
          <div className="relative min-h-[270px] sm:min-h-[380px] lg:min-h-full">
            <Image src="/hero_bg.webp" alt="Warm living room with a cream sofa and coffee table" fill priority sizes="(max-width: 1023px) 100vw, 54vw" className="object-cover object-[62%_center] sm:object-center" />
            <div className="absolute bottom-4 right-4 rounded-full border border-white/60 bg-white/90 px-4 py-2 text-[11px] font-semibold tracking-wide text-foreground shadow-sm backdrop-blur-sm sm:bottom-6 sm:right-6">Spaces to come home to</div>
          </div>
        </div>
      </section>

      {/* ── Features bar ──────────────────────────────────────────── */}
      <section className="border-b border-border bg-white py-5 md:py-6">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4 md:gap-6">
            {FEATURES.map(({ icon: Icon, title, sub }, i) => (
              <AnimateIn key={title} variant="fade-up" delay={i * 80} className="flex items-center gap-3 md:gap-4">
                <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] md:text-sm font-bold text-foreground leading-tight">{title}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 leading-snug">{sub}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Shop By Category ──────────────────────────────────────── */}
      <section className="bg-white py-12 md:py-20">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <AnimateIn variant="fade-up">
            <SectionHeading tag="Find your space" title="Shop by room" />
          </AnimateIn>
          <AnimateIn variant="fade-in" delay={150}>
            <CategorySlider categories={categories} />
          </AnimateIn>
        </div>
      </section>

      {/* ── Popular Products ──────────────────────────────────────── */}
      <section className="bg-[#faf8f5] py-12 md:py-20">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <AnimateIn variant="fade-up">
            <SectionHeading tag="The edit" title="Pieces to start with" />
          </AnimateIn>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {trendingProducts.map((p, i) => (
              <AnimateIn key={p.id} variant="fade-up" delay={i * 80}>
                <HomeTrendingProductCard product={p} isMember={isMember} />
              </AnimateIn>
            ))}
          </div>
          <AnimateIn variant="fade-in" className="text-center mt-10">
            <Link
              href="/products"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-foreground/25 px-7 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              View all furniture <ArrowRight className="h-4 w-4" />
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* ── Promo Banners ─────────────────────────────────────────── */}
      <section className="bg-white py-12 md:py-20">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">

            {/* Dark card */}
            <AnimateIn variant="slide-left" className="relative rounded-2xl overflow-hidden bg-navy min-h-[250px] md:min-h-[300px] flex items-center p-6 md:p-10">
              <div className="relative z-10 max-w-[260px]">
                <p className="text-xs font-bold tracking-widest text-white/70 uppercase mb-3">LIVING ROOM EDIT</p>
                <h3 className="text-3xl font-semibold tracking-tight text-white leading-tight mb-3">A room to<br />unwind in.</h3>
                <p className="text-sm text-white/75 mb-6 leading-relaxed">Sofas, chairs and considered details for everyday comfort.</p>
                <Link href="/categories/living-room" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-navy transition-colors hover:bg-secondary">
                  Explore living room <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="absolute right-0 bottom-0 h-full w-[55%] hidden sm:block">
                <Image
                  src="https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=600&q=80"
                  alt="Living room furniture"
                  fill
                  className="object-cover object-top opacity-80"
                />
                <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-navy to-transparent" />
              </div>
            </AnimateIn>

            {/* Light card */}
            <AnimateIn variant="slide-right" delay={100} className="relative rounded-2xl overflow-hidden bg-secondary min-h-[250px] md:min-h-[300px] flex items-center p-6 md:p-10">
              <div className="relative z-10 max-w-[220px] sm:max-w-[260px]">
                <p className="text-xs font-bold tracking-widest text-primary uppercase mb-3">A LITTLE MORE FOR MEMBERS</p>
                <h3 className="text-3xl font-semibold tracking-tight text-foreground leading-tight mb-3">Make more of your home.</h3>
                <p className="text-sm text-foreground/70 mb-5">Special member prices and free shipping on eligible orders.</p>
                <Link href="/account/membership" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/25 px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary">
                  Explore membership <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <Sparkles className="absolute right-5 top-5 h-6 w-6 text-primary/70" />
              <div className="absolute right-0 bottom-0 h-full w-[50%] hidden sm:block">
                <Image
                  src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80"
                  alt="Special offer furniture"
                  fill
                  className="object-cover object-center opacity-90"
                />
                <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-secondary to-transparent" />
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* ── About Us ─────────────────────────────────────────────── */}
      <section className="overflow-hidden bg-[#f7f3ed] py-14 md:py-20">
        <div className="container mx-auto px-4 sm:px-5 md:px-6 xl:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-center">
            <AnimateIn variant="fade-up" className="order-2 lg:order-1">
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                <div className="aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-lg">
                  <Image
                    src="https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80"
                    alt="Warm, furnished living room"
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                  />
                </div>
              </div>
            </AnimateIn>
            <AnimateIn variant="fade-up" delay={150} className="order-1 lg:order-2">
              <div className="text-left">
                <span className="inline-block text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-3">Our story</span>
                <h2 className="max-w-[15ch] text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-5 leading-tight">
                  Good furniture makes room for life.
                </h2>
                <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                  <p>
                    Based in South Australia, Complete Home Solution brings together furniture for comfortable, useful and welcoming spaces.
                  </p>
                  <p>
                    Explore pieces for the living room, bedroom, dining room and beyond, and find what feels right for your home.
                  </p>
                </div>
                <div className="mt-6 sm:mt-8">
                  <Link
                    href="/products"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                  >
                    Shop the collection <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ────────────────────────────────────────── */}
      <section className="bg-white py-14 md:py-20">
        <div className="container mx-auto px-4 sm:px-5 md:px-6 xl:px-8">
          <AnimateIn variant="fade-up">
            <SectionHeading tag="The details" title="A simpler way to shop for home" />
          </AnimateIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {WHY_US.map(({ icon: Icon, title, desc }, i) => (
              <AnimateIn key={title} variant="fade-up" delay={i * 80}>
                <div className="group h-full rounded-2xl border border-border bg-white p-5 sm:p-6 transition-colors hover:border-primary/30 hover:bg-[#faf8f5]">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1.5">{title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Membership CTA ────────────────────────────────────────── */}
      <section className="py-10 md:py-14 bg-navy">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <AnimateIn variant="fade-up" className="text-center">
            <p className="text-xs font-bold tracking-[0.22em] text-primary uppercase mb-3">EXCLUSIVE MEMBERSHIP</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
              A little extra for your home
            </h2>
            <p className="text-sm sm:text-base text-white/60 mb-7 max-w-lg mx-auto leading-relaxed">
              Join CHS Membership for special member prices and free shipping on eligible orders.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/account/membership"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-7 py-3.5 rounded-lg transition-colors shadow-md"
              >
                Become a Member <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 border border-white/25 text-white hover:bg-white/10 font-semibold text-sm px-7 py-3.5 rounded-lg transition-colors"
              >
                Browse Products
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

    </main>
  );
}
