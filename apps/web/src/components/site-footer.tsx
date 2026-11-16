import { useTranslations } from "next-intl";
import { COMPANY, NAV_LINKS } from "@/content/company";
import { platformUrl, SHOWCASE_PLATFORMS } from "@/content/platforms";
import { Link } from "@/i18n/navigation";
import { CONTAINER } from "@/lib/layout";
import { CompanyLogo } from "./brand";

export function SiteFooter() {
  const t = useTranslations();
  const companyLinks = [...NAV_LINKS, { href: "/contact", key: "contact" } as const];

  return (
    <footer className="border-t bg-bg-alt">
      <div className={`${CONTAINER} grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]`}>
        <div>
          <CompanyLogo />
          <p className="mt-4 max-w-xs text-sm text-text-muted">{t("company.claim")}</p>
          <a href={COMPANY.phone.href} className="mt-3 inline-block text-sm font-semibold hover:text-brand">
            {COMPANY.phone.display}
          </a>
        </div>

        <nav aria-label={t("footer.platforms")}>
          <h2 className="eyebrow mb-3">{t("footer.platforms")}</h2>
          <ul className="flex flex-col gap-2 text-sm font-semibold text-text-muted">
            {SHOWCASE_PLATFORMS.map((platform) => (
              <li key={platform.slug}>
                <a href={platformUrl(platform)} target="_blank" rel="noopener noreferrer" className="hover:text-text">
                  Kouland{platform.product}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("footer.company")}>
          <h2 className="eyebrow mb-3">{t("footer.company")}</h2>
          <ul className="flex flex-col gap-2 text-sm font-semibold text-text-muted">
            {companyLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-text">
                  {t(`nav.${link.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <p className={`${CONTAINER} py-5 text-xs text-text-faint`}>
          {t("footer.rights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
