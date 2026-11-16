import type { Metadata } from "next";
import { COMPANY } from "@/content/company";
import { LOCALES, OG_LOCALE, type Locale } from "@/i18n/routing";

/** `/fr/about` style address of a page in one language. `path` is "" for the home page or "/about". */
export function localizedPath(locale: Locale, path: string): string {
  return `/${locale}${path}`;
}

/** The same page in every language, for hreflang links and the sitemap. */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((locale) => [locale, localizedPath(locale, path)]));
  languages["x-default"] = localizedPath("en", path);
  return languages;
}

/** Title, description, canonical address, hreflang alternates and Open Graph for one page in one language. */
export function pageMetadata({ locale, path, title, description }: { locale: Locale; path: string; title?: string; description: string }): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: localizedPath(locale, path), languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      siteName: COMPANY.name,
      description,
      url: localizedPath(locale, path),
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((other) => other !== locale).map((other) => OG_LOCALE[other]),
    },
  };
}
