import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, ChevronRight, Star, Heart,
  Award, Truck, ShieldCheck, Headphones,
  Armchair, BedDouble, UtensilsCrossed, Monitor, Flower2,
  RotateCcw, BadgeCheck, Tag, Leaf,
} from "lucide-react";

export const metadata: Metadata = { title: "Home — Complete Home Sollution" };

/* ─── Data ─────────────────────────────────────────────────────────── */

const FEATURES = [
  { icon: Award,       title: "Premium Quality",  sub: "Crafted with high quality materials" },
  { icon: Truck,       title: "Fast Delivery",     sub: "Quick & reliable delivery at your doorstep" },
  { icon: ShieldCheck, title: "Secure Payment",    sub: "100% secure payment guarantee" },
  { icon: Headphones,  title: "24/7 Support",      sub: "Dedicated support whenever you need" },
];

const CATEGORIES = [
  { icon: Armchair,        label: "Living Room",     href: "/categories/living-room",     img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80" },
  { icon: BedDouble,       label: "Bedroom",         href: "/categories/bedroom",          img: "https://images.unsplash.com/photo-1505693314120-0d443867891c?auto=format&fit=crop&w=400&q=80" },
  { icon: UtensilsCrossed, label: "Dining Room",     href: "/categories/dining-room",      img: "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=400&q=80" },
  { icon: Monitor,         label: "Office Furniture",href: "/categories/office-furniture", img: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=400&q=80" },
  { icon: Flower2,         label: "Home Decor",      href: "/categories/home-decor",       img: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=400&q=80" },
];

const PRODUCTS = [
  {
    name: "Modern Comfort Sofa",
    price: 1299,
    originalPrice: 1599,
    discount: "-10%",
    rating: 4.5,
    reviews: 120,
    img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Premium Timber Bed Frame",
    price: 899,
    originalPrice: 1199,
    discount: null,
    rating: 4.5,
    reviews: 86,
    img: "https://images.unsplash.com/photo-1505693314120-0d443867891c?auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Elegant Dining Set",
    price: 1499,
    originalPrice: 1799,
    discount: "-15%",
    rating: 4.5,
    reviews: 64,
    img: "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Ergonomic Office Chair",
    price: 449,
    originalPrice: 599,
    discount: null,
    rating: 4,
    reviews: 98,
    img: "https://images.unsplash.com/photo-1593642634524-b40b5baae6bb?auto=format&fit=crop&w=500&q=80",
  },
];

const TRUST = [
  { icon: RotateCcw,   title: "7 Days Easy Returns",      sub: "Hassle-free returns" },
  { icon: BadgeCheck,  title: "Warranty Protection",       sub: "Long-term assurance" },
  { icon: Tag,         title: "Best Price Guarantee",      sub: "Unbeatable prices" },
  { icon: Leaf,        title: "Sustainable Materials",     sub: "Eco-friendly & safe" },
];

/* ─── Sub-components ────────────────────────────────────────────────── */

function SectionHeading({ tag, title }: { tag: string; title: string }) {
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

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`h-3.5 w-3.5 ${s <= Math.floor(rating) ? "fill-amber-400 text-amber-400" : s - 0.5 <= rating ? "fill-amber-400/50 text-amber-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function HomePage() {
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
          <div className="max-w-[520px] py-12 md:py-16 lg:py-20">
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
            <div className="flex flex-col sm:flex-row gap-3 mb-7 md:mb-8">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-7 py-3.5 rounded-lg transition-colors shadow-md w-full sm:w-auto"
              >
                SHOP NOW <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 border-2 border-foreground text-foreground hover:bg-foreground hover:text-white font-bold text-sm px-7 py-3.5 rounded-lg transition-colors w-full sm:w-auto"
              >
                EXPLORE COLLECTION
              </Link>
            </div>
            {/* Slider dots */}
            <div className="flex items-center gap-2">
              <span className="w-7 h-2.5 rounded-full bg-primary" />
              <span className="w-2.5 h-2.5 rounded-full bg-border" />
              <span className="w-2.5 h-2.5 rounded-full bg-border" />
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
              <div key={title} className="flex items-start gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full border-2 border-primary/20 bg-primary/5 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] md:text-sm font-bold text-foreground leading-tight">{title}</p>
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5 leading-snug hidden sm:block">{sub}</p>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {CATEGORIES.map(({ icon: Icon, label, href, img }) => (
              <Link key={label} href={href} className="group block">
                {/* Chip */}
                <div className="flex items-center gap-2 border border-border rounded-full px-3.5 py-2 mb-3 bg-white group-hover:border-primary group-hover:bg-primary/5 transition-colors">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate transition-colors">
                    {label}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                </div>
                {/* Image */}
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-secondary">
                  <Image
                    src={img}
                    alt={label}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </Link>
            ))}
          </div>
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
            {PRODUCTS.map((p) => (
              <div key={p.name} className="group bg-white rounded-2xl border border-border hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                {/* Image */}
                <div className="relative aspect-square bg-secondary overflow-hidden">
                  <Image
                    src={p.img}
                    alt={p.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Discount badge */}
                  {p.discount && (
                    <span className="absolute top-3 left-3 bg-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-full z-10">
                      {p.discount}
                    </span>
                  )}
                  {/* Wishlist */}
                  <button className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow hover:text-primary transition-colors z-10">
                    <Heart className="h-4 w-4" />
                  </button>
                </div>
                {/* Info */}
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-2">
                    {p.name}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-foreground">
                      A${p.price.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground line-through">
                      A${p.originalPrice.toLocaleString()}
                    </span>
                  </div>
                  <StarRating rating={p.rating} count={p.reviews} />
                </div>
              </div>
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
      <section className="bg-navy py-6 md:py-8">
        <div className="container mx-auto px-5 md:px-6 xl:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {TRUST.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full border border-white/20 bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{title}</p>
                  <p className="text-xs text-white/50 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
