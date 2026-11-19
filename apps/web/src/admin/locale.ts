import { CRM_LOCALES, type CrmLocale } from "@kouland/contracts";

/**
 * The CRM has no language in its addresses (/admin/customers, not /fr/admin/customers): the language is the
 * account's setting, kept in this cookie so the server renders the right one on the first load.
 */
export const CRM_LOCALE_COOKIE = "kouland_crm_locale";

export function toCrmLocale(value: string | undefined | null): CrmLocale {
  return CRM_LOCALES.includes(value as CrmLocale) ? (value as CrmLocale) : "en";
}

export function saveCrmLocale(locale: CrmLocale): void {
  document.cookie = `${CRM_LOCALE_COOKIE}=${locale}; path=/admin; max-age=31536000; samesite=lax`;
}

export const LOCALE_NAMES: Record<CrmLocale, string> = { en: "English", fr: "Français", es: "Español" };

/** Intl locale for dates and money. */
export const INTL_LOCALE: Record<CrmLocale, string> = { en: "en-US", fr: "fr-FR", es: "es-ES" };

/** Intl locale for dates: day/month/year in every language (English uses the British order, "20 Nov 2026"). */
export const DATE_LOCALE: Record<CrmLocale, string> = { en: "en-GB", fr: "fr-FR", es: "es-ES" };
