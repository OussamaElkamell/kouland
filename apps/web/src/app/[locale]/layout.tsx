import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ThemeSync } from "@/components/theme-sync";
import { COMPANY } from "@/content/company";
import { routing, type Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "../globals.css";

// Self-hosted variable fonts (SIL Open Font License): the build never depends on reaching Google Fonts.
const inter = localFont({ src: "../../fonts/inter-latin-variable.woff2", weight: "100 900", variable: "--font-inter", display: "swap" });
const manrope = localFont({ src: "../../fonts/manrope-latin-variable.woff2", weight: "200 800", variable: "--font-manrope", display: "swap" });

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(COMPANY.siteUrl),
    title: { default: t("title"), template: `%s — ${COMPANY.shortName}` },
    applicationName: COMPANY.shortName,
    ...pageMetadata({ locale, path: "", description: t("description") }),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  return (
    // Dark is the default theme; the inline script switches to light before first paint if the visitor chose it.
    <html lang={locale} className={`dark ${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <NextIntlClientProvider>
          <ThemeSync />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
