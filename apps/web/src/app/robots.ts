import type { MetadataRoute } from "next";
import { COMPANY } from "@/content/company";

export default function robots(): MetadataRoute.Robots {
  return {
    // The CRM is private and must not be indexed.
    rules: { userAgent: "*", allow: "/", disallow: "/admin" },
    sitemap: `${COMPANY.siteUrl}/sitemap.xml`,
  };
}
