"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart";
import {
  Search, ShoppingBag, Heart, User, ChevronDown, ChevronRight,
  Menu, X, Armchair, BedDouble, UtensilsCrossed, Monitor, Flower2,
  LayoutDashboard, Package, Crown, UserCircle, MapPin,
  LogOut, LogIn, UserPlus, ShieldCheck, LayoutGrid, Loader2,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────── */

interface NavCategory {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  _count: { products: number };
}

interface SearchSuggestion {
  id: string;
  name: string;
  slug: string;
  images: string[];
  basePrice: number;
  category: { name: string; slug: string };
}

/* ─── Category icon mapper ───────────────────────────────────────── */

const SLUG_ICONS: Record<string, React.ElementType> = {
  "living-room":      Armchair,
  "bedroom":          BedDouble,
  "dining-room":      UtensilsCrossed,
  "office-furniture": Monitor,
  "office":           Monitor,
  "home-decor":       Flower2,
};

function getCatIcon(slug: string): React.ElementType {
  for (const [key, Icon] of Object.entries(SLUG_ICONS)) {
    if (slug.includes(key)) return Icon;
  }
  return LayoutGrid;
}

const BASE_ACCOUNT_LINKS = [
  { label: "My Dashboard",  href: "/account/dashboard",  Icon: LayoutDashboard },
  { label: "My Orders",     href: "/account/orders",     Icon: Package },
  { label: "Membership",    href: "/account/membership", Icon: Crown },
  { label: "Profile",       href: "/account/profile",    Icon: UserCircle },
  { label: "Addresses",     href: "/account/addresses",  Icon: MapPin },
];

const ADMIN_LINK = { label: "Admin Panel", href: "/admin", Icon: ShieldCheck };

/* ─── Tiny hook: close on outside click ──────────────────────────── */

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  cb: () => void,
) {
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [ref, cb]);
}

/* ─── NavLink helper ──────────────────────────────────────────────── */

interface NavItemProps {
  readonly href: string;
  readonly active: boolean;
  readonly children: React.ReactNode;
  readonly className?: string;
}

function NavItem({
  href,
  active,
  children,
  className = "",
}: NavItemProps) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-1.5 px-2 py-2 text-[13px] font-semibold tracking-wide transition-colors duration-150
        ${active ? "text-primary" : "text-foreground hover:text-primary"}
        ${className}`}
    >
      {children}
      <span className={`absolute bottom-0 left-0 h-0.5 rounded-full bg-primary transition-transform duration-200 origin-left ${active ? "w-full scale-x-100" : "w-full scale-x-0 group-hover:scale-x-100"}`} />
    </Link>
  );
}

/* ─── Main component ──────────────────────────────────────────────── */

export function Navbar() {
  const pathname  = usePathname();

  /* UI state */
  const [scrolled,       setScrolled]       = useState(false);
  const [mobileOpen,     setMobileOpen]     = useState(false);
  const [mobileCatsOpen, setMobileCatsOpen] = useState(false);
  const [catsOpen,       setCatsOpen]       = useState(false);
  const [userOpen,       setUserOpen]       = useState(false);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [searchVal,      setSearchVal]      = useState("");

  const router = useRouter();

  /* refs */
  const catsRef       = useRef<HTMLDivElement>(null);
  const userRef       = useRef<HTMLDivElement>(null);
  const searchRef     = useRef<HTMLDivElement>(null);
  const searchInp     = useRef<HTMLInputElement>(null);
  const suggestDebRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* dynamic data */
  const [categories,    setCategories]    = useState<NavCategory[]>([]);
  const [suggestions,   setSuggestions]   = useState<SearchSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const user       = session?.user;
  const isAdmin    = user?.role === "ADMIN";
  const ACCOUNT_LINKS = isAdmin ? [ADMIN_LINK, ...BASE_ACCOUNT_LINKS] : BASE_ACCOUNT_LINKS;
  const cartCount  = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0)
  );

  /* scroll shadow */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  /* close all on route change */
  useEffect(() => {
    setCatsOpen(false);
    setUserOpen(false);
    setSearchOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  /* ESC closes everything */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setCatsOpen(false);
      setUserOpen(false);
      setSearchOpen(false);
      setMobileOpen(false);
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  /* body scroll-lock while drawer open */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  /* focus search input when expanded */
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInp.current?.focus(), 60);
  }, [searchOpen]);

  /* fetch categories from DB on mount */
  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.data)) setCategories(d.data); })
      .catch(() => {});
  }, []);

  /* debounced search suggestions */
  useEffect(() => {
    if (suggestDebRef.current) clearTimeout(suggestDebRef.current);
    const q = searchVal.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    suggestDebRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`);
        const data = await res.json();
        setSuggestions(data.products ?? []);
      } catch { setSuggestions([]); }
      setSearchLoading(false);
    }, 300);
    return () => { if (suggestDebRef.current) clearTimeout(suggestDebRef.current); };
  }, [searchVal]);

  /* click-outside handlers */
  useClickOutside(catsRef,   () => setCatsOpen(false));
  useClickOutside(userRef,   () => setUserOpen(false));
  useClickOutside(searchRef, () => { if (!searchVal) { setSearchOpen(false); setSuggestions([]); } });

  /* search submit */
  const handleSearch = (q: string) => {
    if (q.trim()) {
      setSuggestions([]);
      setSearchOpen(false);
      setSearchVal("");
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  };

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <>
      {/* ════════════ HEADER ════════════ */}
      <header
        className={`sticky top-0 z-50 bg-white transition-shadow duration-300
          ${scrolled ? "shadow-lg" : "shadow-sm border-b border-border"}`}
      >
        <div className="flex items-center h-[72px] lg:h-[68px] px-4 md:px-5 gap-4 xl:gap-8 overflow-visible lg:max-w-screen-xl lg:mx-auto lg:px-6 xl:px-10">

            {/* ── Logo (no frame, no text) ─────────────────── */}
            <Link href="/" className="shrink-0 flex items-center" aria-label="Complete Home Sollution – Home">
              <Image
                src="/chs-logo.png"
                alt="Complete Home Sollution"
                width={430}
                height={131}
                className="h-14 lg:h-[100px] xl:h-[131px] w-auto object-contain"
                style={{ width: "auto" }}
                priority
              />
            </Link>

            {/* ── Desktop navigation ──────────────────────── */}
            <nav className="hidden lg:flex items-center gap-5 ml-2" aria-label="Main navigation">

              <NavItem href="/" active={pathname === "/"}>HOME</NavItem>
              <NavItem href="/products" active={pathname.startsWith("/products")}>SHOP</NavItem>

              {/* Categories mega-menu */}
              <div ref={catsRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setCatsOpen(!catsOpen); setUserOpen(false); setSearchOpen(false); }}
                  aria-expanded={catsOpen}
                  aria-haspopup="true"
                  className={`group relative flex items-center gap-1.5 px-2 py-2 text-[13px] font-semibold tracking-wide transition-colors duration-150
                    ${pathname.startsWith("/categories")
                      ? "text-primary"
                      : "text-foreground hover:text-primary"}`}
                >
                  CATEGORIES
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${catsOpen ? "rotate-180" : ""}`} />
                  <span className={`absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-primary transition-transform duration-200 origin-left ${pathname.startsWith("/categories") ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
                </button>

                {/* Mega dropdown */}
                {catsOpen && (
                  <div
                    role="menu"
                    className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[500px] bg-white rounded-2xl shadow-2xl border border-border p-5 z-50"
                  >
                    <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase mb-4">
                      Browse by Category
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {categories.length === 0
                        ? Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                              <div className="space-y-1.5 flex-1">
                                <div className="h-3 w-20 bg-slate-100 rounded" />
                                <div className="h-2.5 w-16 bg-slate-100 rounded" />
                              </div>
                            </div>
                          ))
                        : categories.map((cat) => {
                            const CatIcon = getCatIcon(cat.slug);
                            return (
                              <Link
                                key={cat.id}
                                href={`/categories/${cat.slug}`}
                                role="menuitem"
                                className="group flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
                              >
                                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                                  <CatIcon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-none mb-0.5">
                                    {cat.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {cat._count.products} product{cat._count.products !== 1 ? "s" : ""}
                                  </p>
                                </div>
                              </Link>
                            );
                          })
                      }
                    </div>
                    <div className="mt-3 pt-3 border-t border-border">
                      <Link
                        href="/products"
                        className="flex items-center justify-center gap-1.5 text-sm font-bold text-primary hover:underline"
                      >
                        View All Products <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <NavItem href="/blog" active={pathname.startsWith("/blog")}>BLOG</NavItem>
              
              <NavItem
                href="/account/membership"
                active={pathname.startsWith("/account/membership")}
              >
                MEMBERSHIP
              </NavItem>
            </nav>

            <div className="flex-1" />

            {/* ── Search (expandable + live suggestions) ─── */}
            <div ref={searchRef} className="hidden md:flex items-center relative">
              {searchOpen ? (
                <div className="relative">
                  <div className="flex items-center gap-2 bg-secondary border border-primary/25 rounded-full px-4 py-2 w-64">
                    <Search className="h-4 w-4 text-primary shrink-0" />
                    <input
                      ref={searchInp}
                      type="text"
                      placeholder="Search furniture…"
                      value={searchVal}
                      onChange={e => setSearchVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleSearch(searchVal);
                        if (e.key === "Escape") { setSearchOpen(false); setSearchVal(""); setSuggestions([]); }
                      }}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
                      aria-label="Search"
                    />
                    {searchLoading
                      ? <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
                      : <button
                          onClick={() => { setSearchOpen(false); setSearchVal(""); setSuggestions([]); }}
                          aria-label="Close search"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                    }
                  </div>
                  {/* Live suggestions dropdown */}
                  {suggestions.length > 0 && (
                    <div className="absolute top-[calc(100%+8px)] right-0 w-80 bg-white rounded-xl shadow-2xl border border-border z-50 overflow-hidden">
                      <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Results</p>
                      {suggestions.map((item) => (
                        <Link
                          key={item.id}
                          href={`/products/${item.slug}`}
                          onClick={() => { setSearchOpen(false); setSearchVal(""); setSuggestions([]); }}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                            {item.images[0]
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-slate-300" /></div>
                            }
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground group-hover:text-primary truncate leading-tight">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.category.name}</p>
                          </div>
                          <p className="text-sm font-bold text-foreground shrink-0">
                            A${item.basePrice.toLocaleString()}
                          </p>
                        </Link>
                      ))}
                      <div className="border-t border-border p-2">
                        <button
                          onClick={() => handleSearch(searchVal)}
                          className="w-full flex items-center justify-center gap-1.5 text-sm font-bold text-primary hover:bg-primary/5 rounded-lg py-1.5 transition-colors"
                        >
                          <Search className="h-3.5 w-3.5" />
                          See all results for "{searchVal}"
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { setSearchOpen(true); setCatsOpen(false); setUserOpen(false); }}
                  aria-label="Search"
                  className="w-10 h-10 rounded-full hover:bg-secondary flex items-center justify-center text-foreground hover:text-primary transition-colors"
                >
                  <Search className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>

          

            {/* ── Wishlist ────────────────────────────────── */}
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className={`hidden md:flex w-10 h-10 rounded-full hover:bg-secondary items-center justify-center transition-colors relative
                ${pathname.startsWith("/wishlist") ? "text-primary" : "text-foreground hover:text-primary"}`}
            >
              <Heart className="h-[18px] w-[18px]" />
            </Link>

            {/* ── Cart ────────────────────────────────────── */}
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex w-10 h-10 rounded-full hover:bg-secondary items-center justify-center text-foreground hover:text-primary transition-colors"
            >
              <ShoppingBag className="h-[18px] w-[18px]" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center leading-none px-1">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

              {/* ── User dropdown ───────────────────────────── */}
            <div ref={userRef} className="hidden md:block relative">
              <div className="relative">
                <button
                  onClick={() => { setUserOpen(!userOpen); setCatsOpen(false); setSearchOpen(false); }}
                  aria-label="Account"
                  aria-expanded={userOpen}
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden transition-all
                    ${userOpen ? "ring-2 ring-primary ring-offset-1" : "hover:ring-2 hover:ring-primary/40 hover:ring-offset-1"}
                    ${user?.isMember ? "ring-2 ring-primary" : ""}`}
                >
                  {user?.image ? (
                    <Image src={user.image} alt={user.name ?? "Account"} width={32} height={32} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className={`w-full h-full rounded-full flex items-center justify-center ${user?.isMember ? "bg-primary" : "bg-primary/10"}`}>
                      {user?.name ? (
                        <span className={`text-[13px] font-bold ${user?.isMember ? "text-white" : "text-primary"}`}>{user.name.charAt(0).toUpperCase()}</span>
                      ) : (
                        <User className={`h-[18px] w-[18px] ${user?.isMember ? "text-white" : "text-foreground"}`} />
                      )}
                    </div>
                  )}
                </button>
                {/* Member Crown Badge - positioned outside the button */}
                {user?.isMember && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-md border border-white z-10">
                    <Crown className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>

              {userOpen && (
                <div
                  role="menu"
                  className="absolute top-[calc(100%+10px)] right-0 w-60 bg-white rounded-2xl shadow-2xl border border-border z-50 overflow-hidden"
                >
                  {isLoggedIn ? (
                    <>
                      <div className="px-5 py-4 bg-secondary/60 border-b border-border flex items-center gap-3">
                        {user?.image ? (
                          <Image src={user.image} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-white">{user?.name?.charAt(0)?.toUpperCase() ?? "U"}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{user?.name ?? "My Account"}</p>
                            {user?.isMember && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary">
                                <Crown className="w-3 h-3" /> Member
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                        </div>
                      </div>
                      <div className="py-1.5">
                        {ACCOUNT_LINKS.map(({ label, href, Icon }) => {
                          const isAdminLink = href === "/admin";
                          const isMembershipLink = href === "/account/membership";
                          return (
                            <Link
                              key={href}
                              href={href}
                              role="menuitem"
                              className={`group flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                isAdminLink
                                  ? "text-primary font-semibold hover:bg-primary/8 hover:text-primary"
                                  : "text-foreground hover:bg-secondary hover:text-primary"
                              }`}
                            >
                              <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                                isAdminLink ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                              }`} />
                              {label}
                              {isAdminLink && (
                                <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                  Admin
                                </span>
                              )}
                              {isMembershipLink && user?.isMember && (
                                <span className="ml-auto text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">
                                  Active
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                      <div className="border-t border-border py-1.5">
                        <button
                          role="menuitem"
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => signOut({ callbackUrl: "/" })}
                        >
                          <LogOut className="h-4 w-4 shrink-0" /> Sign Out
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 space-y-2.5">
                      <Link
                        href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
                        className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                      >
                        <LogIn className="h-4 w-4" /> Sign In
                      </Link>
                      <Link
                        href={`/register?callbackUrl=${encodeURIComponent(pathname)}`}
                        className="flex items-center justify-center gap-2 w-full border-2 border-foreground text-foreground hover:bg-foreground hover:text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                      >
                        <UserPlus className="h-4 w-4" /> Create Account
                      </Link>
                      <p className="text-center text-[11px] text-muted-foreground pt-0.5">
                        Members save up to 30% on every order
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Mobile hamburger ────────────────────────── */}
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              className="lg:hidden flex w-10 h-10 rounded-full hover:bg-secondary items-center justify-center text-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
        </div>
      </header>

      {/* ════════════ MOBILE DRAWER ════════════ */}

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden
          ${mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />

      {/* Drawer panel */}
      <aside
        aria-label="Mobile navigation"
        className={`fixed top-0 right-0 h-full w-[min(82vw,360px)] bg-white z-[70] shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out lg:hidden
          ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between h-[72px] px-4 border-b border-border shrink-0">
          <Link href="/" onClick={() => setMobileOpen(false)} aria-label="Home">
            <Image
              src="/chs-logo.png"
              alt="Complete Home Sollution"
              width={180}
              height={55}
              className="h-10 w-auto object-contain"
              style={{ width: "auto" }}
            />
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="w-10 h-10 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Inline search */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-2.5 border border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search furniture…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={e => {
                if (e.key === "Enter") handleSearch((e.target as HTMLInputElement).value);
              }}
              aria-label="Search"
            />
          </div>
        </div>

        {/* Scrollable nav list */}
        <nav className="flex-1 overflow-y-auto px-3 py-1" aria-label="Mobile navigation">

          {/* Home */}
          <Link
            href="/"
            className={`flex items-center justify-between px-3.5 py-3.5 rounded-xl text-sm font-semibold mb-0.5 transition-colors
              ${pathname === "/" ? "bg-primary/8 text-primary" : "text-foreground hover:bg-secondary"}`}
          >
            Home <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          {/* Shop */}
          <Link
            href="/products"
            className={`flex items-center justify-between px-3.5 py-3.5 rounded-xl text-sm font-semibold mb-0.5 transition-colors
              ${pathname.startsWith("/products") ? "bg-primary/8 text-primary" : "text-foreground hover:bg-secondary"}`}
          >
            Shop All Products <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          {/* Blog */}
          <Link
            href="/blog"
            className={`flex items-center justify-between px-3.5 py-3.5 rounded-xl text-sm font-semibold mb-0.5 transition-colors
              ${pathname.startsWith("/blog") ? "bg-primary/8 text-primary" : "text-foreground hover:bg-secondary"}`}
          >
            Blog <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          {/* Categories accordion */}
          <button
            onClick={() => setMobileCatsOpen(!mobileCatsOpen)}
            aria-expanded={mobileCatsOpen}
            className="w-full flex items-center justify-between px-3.5 py-3.5 rounded-xl text-sm font-semibold text-foreground hover:bg-secondary transition-colors mb-0.5"
          >
            Categories
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${mobileCatsOpen ? "rotate-180" : ""}`} />
          </button>

          {mobileCatsOpen && (
            <div className="mb-0.5 pl-2 space-y-0.5">
              {categories.map((cat) => {
                const CatIcon = getCatIcon(cat.slug);
                return (
                  <Link
                    key={cat.id}
                    href={`/categories/${cat.slug}`}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm text-foreground hover:bg-secondary hover:text-primary transition-colors group"
                  >
                    <CatIcon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{cat.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* Membership */}
          <Link
            href="/account/membership"
            className={`flex items-center justify-between px-3.5 py-3.5 rounded-xl text-sm font-semibold mb-0.5 transition-colors
              ${pathname.startsWith("/account/membership") ? "bg-primary/8 text-primary" : "text-foreground hover:bg-secondary"}`}
          >
            <span className="flex items-center gap-2">
              Membership
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Link
            href="/wishlist"
            className={`flex items-center justify-between px-3.5 py-3.5 rounded-xl text-sm font-semibold mb-0.5 transition-colors
              ${pathname.startsWith("/wishlist") ? "bg-primary/8 text-primary" : "text-foreground hover:bg-secondary"}`}
          >
            <span className="flex items-center gap-2">
              Wishlist
            </span>
            <span className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </span>
          </Link>

          <div className="mx-1 my-3 h-px bg-border" />

          {/* Account links / auth */}
          {isLoggedIn ? (
            <div className="space-y-0.5">
              {ACCOUNT_LINKS.map(({ label, href, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm text-foreground hover:bg-secondary hover:text-primary transition-colors"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{label}</span>
                </Link>
              ))}
              <button
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors mt-1"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-4 w-4 shrink-0" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="px-1 space-y-2.5">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
                className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white text-sm font-bold py-3 rounded-xl transition-colors"
              >
                <LogIn className="h-4 w-4" /> Sign In
              </Link>
              <Link
                href={`/register?callbackUrl=${encodeURIComponent(pathname)}`}
                className="flex items-center justify-center gap-2 w-full border-2 border-foreground text-foreground hover:bg-foreground hover:text-white text-sm font-bold py-3 rounded-xl transition-colors"
              >
                <UserPlus className="h-4 w-4" /> Create Account
              </Link>
            </div>
          )}
        </nav>

        {/* Drawer footer */}
        <div className="shrink-0 px-5 py-4 border-t border-border bg-secondary/40">
          <p className="text-center text-xs text-muted-foreground leading-snug">
            ⭐ Members save up to 30% on every purchase
          </p>
        </div>
      </aside>
    </>
  );
}
