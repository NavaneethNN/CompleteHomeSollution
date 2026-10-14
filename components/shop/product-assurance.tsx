import Link from "next/link";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";

const information = [
  { icon: Truck, title: "Delivery options", detail: "Calculated for your address at checkout", href: "/shipping-policy" },
  { icon: RotateCcw, title: "Returns", detail: "See the 30-day returns policy and conditions", href: "/refund-policy" },
  { icon: ShieldCheck, title: "Warranty information", detail: "Check what is covered before you buy", href: "/refund-policy" },
];

export function ProductAssurance() {
  return (
    <div className="divide-y divide-border/70 rounded-2xl border border-border bg-[#faf8f5] px-4 sm:px-5">
      {information.map(({ icon: Icon, title, detail, href }) => (
        <Link key={title} href={href} className="flex min-h-[74px] items-center gap-4 py-3 transition-colors hover:text-primary">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm"><Icon className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detail}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
