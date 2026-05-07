import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin } from "lucide-react";

const footerLinks = [
  {
    heading: "Shop",
    links: [
      { label: "All Products", href: "/products" },
      { label: "Living Room", href: "/categories/living-room" },
      { label: "Bedroom", href: "/categories/bedroom" },
      { label: "Dining Room", href: "/categories/dining-room" },
      { label: "Office Furniture", href: "/categories/office-furniture" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Login", href: "/login" },
      { label: "Register", href: "/register" },
      { label: "My Orders", href: "/account/orders" },
      { label: "Membership", href: "/account/membership" },
      { label: "Wishlist", href: "/account/dashboard" },
    ],
  },
  {
    heading: "Help",
    links: [
      { label: "Search", href: "/search" },
      { label: "Shipping Info", href: "#" },
      { label: "Returns & Refunds", href: "#" },
      { label: "Contact Us", href: "#" },
      { label: "FAQs", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer style={{ backgroundColor: "var(--navy)" }}>
      <div className="container mx-auto px-4 xl:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block mb-5" aria-label="Complete Home Sollution — Home">
              <Image
                src="/chs-logo.png"
                alt="Complete Home Sollution"
                width={180}
                height={55}
                className="h-12 w-auto object-contain brightness-0 invert"
                style={{ width: "auto" }}
              />
            </Link>
            <p className="text-sm text-white/50 leading-relaxed mb-6">
              Premium furniture delivered across Australia. Quality pieces for every room, proudly based in South Australia.
            </p>
            <div className="space-y-2.5 text-sm text-white/50">
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <span>33 Edward Street<br />Paralowie SA 5108</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href="tel:+61401682910" className="hover:text-primary transition-colors">+61 401 682 910</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href="mailto:info@completehomesollution.com.au" className="hover:text-primary transition-colors">info@completehomesollution.com.au</a>
              </div>
            </div>
          </div>

          {footerLinks.map(({ heading, links }) => (
            <div key={heading}>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-5">{heading}</h4>
              <ul className="space-y-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-white/50 hover:text-primary transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <p>© {new Date().getFullYear()} Complete Home Sollution. All rights reserved.</p>
          <p>Prices in AUD · GST included · Delivery across Australia</p>
        </div>
      </div>
    </footer>
  );
}
