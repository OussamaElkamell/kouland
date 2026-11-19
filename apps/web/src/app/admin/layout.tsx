import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { CRM_LOCALE_COOKIE, toCrmLocale } from "@/admin/locale";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "../globals.css";

const inter = localFont({ src: "../../fonts/inter-latin-variable.woff2", weight: "100 900", variable: "--font-inter", display: "swap" });
const manrope = localFont({ src: "../../fonts/manrope-latin-variable.woff2", weight: "200 800", variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Kouland CRM", template: "%s — Kouland CRM" },
  // The CRM is private: keep it out of search engines.
  robots: { index: false, follow: false },
};

/**
 * Root layout of the CRM (kouland.com/admin). It sits outside the website's [locale] segment: the language comes
 * from the account's setting (cookie), and every screen is rendered in the browser after the session is checked.
 */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const locale = toCrmLocale((await cookies()).get(CRM_LOCALE_COOKIE)?.value);
  const messages = (await import(`../../../messages/admin/${locale}.json`)).default;

  return (
    <html lang={locale} data-platform="parent" className={`dark ${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="America/Chicago">
          <ThemeSync />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
