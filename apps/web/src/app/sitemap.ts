import type { MetadataRoute } from "next";
import { COMPANY } from "@/content/company";
import { LEGAL_DOCUMENTS } from "@/content/legal";
import { LOCALES } from "@/i18n/routing";
import { languageAlternates, localizedPath } from "@/lib/seo";

const LEGAL_PAGES: string[] = Object.values(LEGAL_DOCUMENTS).map((doc) => doc.path);
const PAGES = ["", "/platforms", "/services", "/about", "/careers", "/contact", ...LEGAL_PAGES];
const absolute = (path: string) => `${COMPANY.siteUrl}${path}`;

/** One entry per page per language, each listing the same page in the other languages. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: absolute(localizedPath(locale, path)),
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : LEGAL_PAGES.includes(path) ? 0.3 : 0.7,
      alternates: {
        languages: Object.fromEntries(Object.entries(languageAlternates(path)).map(([lang, href]) => [lang, absolute(href)])),
      },
    })),
  );
}
