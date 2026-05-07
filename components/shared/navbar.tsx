"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search, ShoppingBag, Heart, User, ChevronDown, ChevronRight,
  Menu, X, Armchair, BedDouble, UtensilsCrossed, Monitor, Flower2,
  LayoutDashboard, Package, Crown, UserCircle, MapPin,
  LogOut, LogIn, UserPlus,
} from "lucide-react";

/* ─── Static data ─────────────────────────────────────────────────── */

const CATEGORIES = [
  { label: "Living Room",     href: "/categories/living-room",      Icon: Armchair,        desc: "Sofas, coffee tables & more" },
  { label: "Bedroom",         href: "/categories/bedroom",           Icon: BedDouble,       desc: "Beds, wardrobes & nightstands" },
  { label: "Dining Room",     href: "/categories/dining-room",       Icon: UtensilsCrossed, desc: "Dining sets, chairs & buffets" },
  { label: "Office Furniture",href: "/categories/office-furniture",  Icon: Monitor,         desc: "Desks, ergonomic chairs & shelves" },
  { label: "Home Decor",      href: "/categories/home-decor",        Icon: Flower2,         desc: "Accents, rugs & accessories" },
] as const;

const ACCOUNT_LINKS = [
  { label: "My Dashboard",  href: "/account/dashboard",  Icon: LayoutDashboard },
  { label: "My Orders",     href: "/account/orders",     Icon: Package },
  { label: "Membership",    href: "/account/membership", Icon: Crown },
  { label: "Profile",       href: "/account/profile",    Icon: UserCircle },
  { label: "Addresses",     href: "/account/addresses",  Icon: MapPin },
] as const;

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

function NavItem({
  href,
  active,
  children,
  className = "",
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
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

  /* refs for click-outside */
  const catsRef   = useRef<HTMLDivElement>(null);
  const userRef   = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInp = useRef<HTMLInputElement>(null);

  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const user       = session?.user;
  const cartCount  = 0; /* swap with useCartStore(s => s.items.reduce(...)) */

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

  /* click-outside handlers */
  useClickOutside(catsRef,   () => setCatsOpen(false));
  useClickOutside(userRef,   () => setUserOpen(false));
  useClickOutside(searchRef, () => { if (!searchVal) setSearchOpen(false); });

  /* search submit */
  const handleSearch = (q: string) => {
    if (q.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(q.trim())}`;
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
        <div className="flex items-center h-[68px] gap-4 xl:gap-8 overflow-visible lg:max-w-screen-xl lg:mx-auto lg:px-6 xl:px-10">

            {/* ── Logo (no frame, no text) ─────────────────── */}
            <Link href="/" className="shrink-0 flex items-center" aria-label="Complete Home Sollution – Home">
              <Image
                src="/chs-logo.png"
                alt="Complete Home Sollution"
                width={430}
                height={131}
                className="h-[100px] lg:h-[131px] w-auto object-contain "
                style={{ width: "auto" }}
                priority
              />
            </Link>

            {/* ── Desktop navigation ──────────────────────── */}
            <nav className="hidden lg:flex items-center gap-0.5 ml-2" aria-label="Main navigation">

              <NavItem href="/" active={pathname === "/"}>HOME</NavItem>
              <NavItem href="/products" active={pathname.startsWith("/products")}>SHOP</NavItem>

              {/* Categories mega-menu */}
              <div
                ref={catsRef}
                className="relative"
                onMouseEnter={() => { setCatsOpen(true); setUserOpen(false); setSearchOpen(false); }}
                onMouseLeave={() => setCatsOpen(false)}
              >
                <button
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
                      {CATEGORIES.map(({ label, href, Icon, desc }) => (
                        <Link
                          key={href}
                          href={href}
                          role="menuitem"
                          className="group flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
                        >
                          <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-none mb-0.5">
                              {label}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{desc}</p>
                          </div>
                        </Link>
                      ))}
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

              <NavItem
                href="/account/membership"
                active={pathname.startsWith("/account/membership")}
              >
                MEMBERSHIP
              </NavItem>
            </nav>

            <div className="flex-1" />

            {/* ── Search (expandable) ─────────────────────── */}
            <div ref={searchRef} className="hidden md:flex items-center">
              {searchOpen ? (
                <div className="flex items-center gap-2 bg-secondary border border-primary/25 rounded-full px-4 py-2 w-60">
                  <Search className="h-4 w-4 text-primary shrink-0" />
                  <input
                    ref={searchInp}
                    type="text"
                    placeholder="Search furniture…"
                    value={searchVal}
                    onChange={e => setSearchVal(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch(searchVal)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
                    aria-label="Search"
                  />
                  <button
                    onClick={() => { setSearchOpen(false); setSearchVal(""); }}
                    aria-label="Close search"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
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

            {/* ── User dropdown ───────────────────────────── */}
            <div ref={userRef} className="hidden md:block relative">
              <button
                onClick={() => { setUserOpen(!userOpen); setCatsOpen(false); setSearchOpen(false); }}
                aria-label="Account"
                aria-expanded={userOpen}
                className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden transition-colors
                  ${userOpen ? "ring-2 ring-primary ring-offset-1" : "hover:ring-2 hover:ring-primary/40 hover:ring-offset-1"}`}
              >
                {user?.image ? (
                  <img src={user.image} alt={user.name ?? "Account"} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                    {user?.name ? (
                      <span className="text-[13px] font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
                    ) : (
                      <User className="h-[18px] w-[18px] text-foreground" />
                    )}
                  </div>
                )}
              </button>

              {userOpen && (
                <div
                  role="menu"
                  className="absolute top-[calc(100%+10px)] right-0 w-60 bg-white rounded-2xl shadow-2xl border border-border z-50 overflow-hidden"
                >
                  {isLoggedIn ? (
                    <>
                      <div className="px-5 py-4 bg-secondary/60 border-b border-border flex items-center gap-3">
                        {user?.image ? (
                          <img src={user.image} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-white">{user?.name?.charAt(0)?.toUpperCase() ?? "U"}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{user?.name ?? "My Account"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                        </div>
                      </div>
                      <div className="py-1.5">
                        {ACCOUNT_LINKS.map(({ label, href, Icon }) => (
                          <Link
                            key={href}
                            href={href}
                            role="menuitem"
                            className="group flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary hover:text-primary transition-colors"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                            {label}
                          </Link>
                        ))}
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
                        href="/login"
                        className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                      >
                        <LogIn className="h-4 w-4" /> Sign In
                      </Link>
                      <Link
                        href="/register"
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

            {/* ── Wishlist ────────────────────────────────── */}
            <Link
              href="/account/dashboard"
              aria-label="Wishlist"
              className="hidden md:flex w-10 h-10 rounded-full hover:bg-secondary items-center justify-center text-foreground hover:text-primary transition-colors"
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

            {/* ── Mobile hamburger ────────────────────────── */}
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              className="lg:hidden flex w-10 h-10 rounded-full hover:bg-secondary items-center justify-center text-foreground transition-colors mr-4"
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
        <div className="flex items-center justify-end h-[68px] px-4 border-b border-border shrink-0">
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
              {CATEGORIES.map(({ label, href, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm text-foreground hover:bg-secondary hover:text-primary transition-colors group"
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium">{label}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                </Link>
              ))}
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
                href="/login"
                className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white text-sm font-bold py-3 rounded-xl transition-colors"
              >
                <LogIn className="h-4 w-4" /> Sign In
              </Link>
              <Link
                href="/register"
                className="flex items-center justify-center gap-2 w-full border-2 border-foreground text-foreground hover:bg-foreground hover:text-white text-sm font-bold py-3 rounded-xl transition-colors"
              >
                <UserPlus className="h-4 w-4" /> Create Account
              </Link>
            </div>
          )}
        </nav>

        <div className="shrink-0 flex justify-center px-4 py-5">
          <Image
            src="/Chs-logo.png"
            alt="Complete Home Sollution"
            width={360}
            height={110}
            className="h-[110px] w-auto object-contain"
            style={{ width: "auto" }}
          />
        </div>

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
