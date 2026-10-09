import type { MetadataRoute } from "next";
import { indexingEnabled, siteOrigin } from "@/lib/site-indexing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: indexingEnabled()
      ? { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/account/", "/checkout", "/cart", "/qa", "/order-confirmation/"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: indexingEnabled() ? `${siteOrigin()}/sitemap.xml` : undefined,
  };
}
