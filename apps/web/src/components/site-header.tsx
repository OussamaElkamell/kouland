"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";
import { NAV_LINKS } from "@/content/company";
import { Link, usePathname } from "@/i18n/navigation";
import { CONTAINER } from "@/lib/layout";
import { CompanyLogo } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  const linkClass = (href: string) =>
    `text-sm font-semibold transition-colors ${pathname === href ? "text-brand-text" : "text-text-muted hover:text-text"}`;
  const mobileLinks = [...NAV_LINKS, { href: "/contact", key: "contactUs" } as const];

  return (
    <header className="sticky top-0 z-40 border-b bg-bg/85 backdrop-blur">
      <div className={`${CONTAINER} flex h-16 items-center justify-between gap-4`}>
        <Link href="/" aria-label={t("home")}>
          <CompanyLogo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label={t("main")}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)} aria-current={pathname === link.href ? "page" : undefined}>
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <LanguageSwitcher className="hidden sm:block" />
          <ThemeToggle />
          <Link href="/contact" className="btn btn-primary btn-sm hidden lg:inline-flex">
            {t("contactUs")}
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm !px-2.5 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t px-4 py-3 md:hidden">
          <nav aria-label={t("main")}>
            <ul className="flex flex-col gap-1">
              {mobileLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={`block rounded-md px-3 py-2.5 ${linkClass(link.href)}`}>
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <LanguageSwitcher className="mt-3 px-3 sm:hidden" />
        </div>
      )}
    </header>
  );
}
