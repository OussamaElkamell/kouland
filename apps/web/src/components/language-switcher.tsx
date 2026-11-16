"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALES } from "@/i18n/routing";

/** Each language is named in its own language, so visitors can find theirs whatever page they are on. */
const LANGUAGE_NAMES = { en: "English", fr: "Français", es: "Español" } as const;

/** EN / FR / ES switch. It keeps the visitor on the same page in the other language. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const t = useTranslations("nav");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("language")} className={className}>
      <ul className="flex items-center rounded-full border p-0.5 text-xs font-bold">
        {LOCALES.map((locale) => {
          const active = locale === current;
          return (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                title={LANGUAGE_NAMES[locale]}
                aria-label={LANGUAGE_NAMES[locale]}
                aria-current={active ? "true" : undefined}
                className={`block rounded-full px-2.5 py-1 uppercase transition-colors ${
                  active ? "gradient-brand text-white" : "text-text-muted hover:text-text"
                }`}
              >
                {locale}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
