import type { Metadata } from "next";
import { Inter, Dancing_Script } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shared/providers";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { ShopShell } from "@/components/shared/shop-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing-script",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Complete Home Sollution — Premium Furniture for Australian Homes",
    template: "%s | Complete Home Sollution",
  },
  description:
    "Shop premium furniture for every room. Based in Golden Grove SA, delivering quality pieces for living, dining, bedroom and office across Australia.",
  keywords: ["furniture", "Australian furniture", "home decor", "sofas", "beds", "dining tables", "South Australia", "Adelaide"],
  icons: {
    icon: "/chs-logo.png",
    shortcut: "/chs-logo.png",
    apple: "/chs-logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: "https://completehomesollution.com.au",
    siteName: "Complete Home Sollution",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <body className={`${inter.variable} ${dancingScript.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <Providers>
          <ShopShell>{children}</ShopShell>
        </Providers>
      </body>
    </html>
  );
}
