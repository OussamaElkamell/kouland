import { defineRouting } from "next-intl/routing";

export const LOCALES = ["en", "fr", "es"] as const;
export type Locale = (typeof LOCALES)[number];

/** Open Graph locale for each website language. */
export const OG_LOCALE: Record<Locale, string> = { en: "en_US", fr: "fr_FR", es: "es_ES" };

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "en",
  // Every page has its language in the URL (/en, /fr, /es), so search engines get one clear address per language.
  localePrefix: "always",
});
