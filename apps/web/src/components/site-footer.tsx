import { useTranslations } from "next-intl";
import { COMPANY, NAV_LINKS } from "@/content/company";
import { LEGAL_DOCUMENTS, LEGAL_KEYS } from "@/content/legal";
import { platformUrl, SHOWCASE_PLATFORMS } from "@/content/platforms";
import { Link } from "@/i18n/navigation";
import { CONTAINER } from "@/lib/layout";
import { CompanyLogo } from "./brand";
import { PlatformName } from "./platform-name";

export function SiteFooter() {
  const t = useTranslations();
  const companyLinks = [...NAV_LINKS, { href: "/contact", key: "contact" } as const, { href: "/support", key: "support" } as const];

  return (
    <footer className="border-t bg-bg-alt">
      <div className={`${CONTAINER} grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]`}>
        <div>
          <CompanyLogo />
          <p className="mt-4 max-w-xs text-sm text-text-muted">{t("company.claim")}</p>
          <address className="mt-4 flex flex-col gap-1.5 text-sm not-italic text-text-muted">
            <a href={COMPANY.address.mapHref} target="_blank" rel="noopener noreferrer" className="hover:text-text">
              {COMPANY.address.street}, {COMPANY.address.locality}
            </a>
            <a href={COMPANY.email.href} className="hover:text-text">
              {COMPANY.email.display}
            </a>
            <a href={COMPANY.phone.href} className="font-semibold text-text hover:text-brand-text">
              {COMPANY.phone.display}
            </a>
          </address>
        </div>

        <nav aria-label={t("footer.platforms")}>
          <h2 className="eyebrow mb-3">{t("footer.platforms")}</h2>
          <ul className="flex flex-col gap-2 text-sm font-semibold text-text-muted">
            {SHOWCASE_PLATFORMS.map((platform) => (
              <li key={platform.slug}>
                <a href={platformUrl(platform)} target="_blank" rel="noopener noreferrer" className="hover:text-text">
                  <PlatformName platform={platform} />
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

        <nav aria-label={t("footer.legal")}>
          <h2 className="eyebrow mb-3">{t("footer.legal")}</h2>
          <ul className="flex flex-col gap-2 text-sm font-semibold text-text-muted">
            {LEGAL_KEYS.map((key) => (
              <li key={key}>
                <Link href={LEGAL_DOCUMENTS[key].path} className="hover:text-text">
                  {t(`legal.${key}.title`)}
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
