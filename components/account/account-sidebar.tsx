"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Crown,
  UserCircle,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Dashboard", href: "/account/dashboard", Icon: LayoutDashboard },
  { label: "My Orders", href: "/account/orders", Icon: Package },
  { label: "Membership", href: "/account/membership", Icon: Crown },
  { label: "Profile", href: "/account/profile", Icon: UserCircle },
  { label: "Addresses", href: "/account/addresses", Icon: MapPin },
] as const;

interface AccountSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isMember?: boolean;
  };
}

export function AccountSidebar({ user }: AccountSidebarProps) {
  const pathname = usePathname();
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user.email?.[0] ?? "U").toUpperCase();

  return (
    <aside className="hidden lg:block lg:w-60 xl:w-64 shrink-0">
      {/* Avatar card */}
      <div
        className="rounded-2xl p-6 mb-4 flex flex-col items-center text-center text-white"
        style={{ backgroundColor: "var(--navy)" }}
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name ?? ""}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-full object-cover ring-4 ring-white/20 mb-3"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center ring-4 ring-white/20 mb-3">
            <span className="text-2xl font-black text-white">{initials}</span>
          </div>
        )}
        <p className="font-bold text-base leading-tight">{user.name ?? "Welcome"}</p>
        <p className="text-white/55 text-xs mt-0.5 truncate max-w-full">{user.email}</p>
        {user.isMember && (
          <span className="mt-3 inline-flex items-center gap-1 bg-amber-400/20 text-amber-300 text-[11px] font-bold px-3 py-1 rounded-full">
            <Crown className="h-3 w-3" /> MEMBER
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="bg-white rounded-2xl overflow-hidden border border-border shadow-sm">
        {NAV_LINKS.map(({ label, href, Icon }, i) => {
          const isActive = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors group",
                isActive
                  ? "bg-primary/8 text-primary border-l-[3px] border-primary"
                  : "text-foreground hover:bg-secondary hover:text-primary border-l-[3px] border-transparent",
                i !== 0 && "border-t border-border"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
