import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Icon, IconBadge } from "@kouland/ui";
import { COMPANY } from "@/content/company";
import { LEGAL_DOCUMENTS, sectionId, type LegalBlock, type LegalKey } from "@/content/legal";
import type { Locale } from "@/i18n/routing";
import { CONTAINER } from "@/lib/layout";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "./section";

export async function legalMetadata(locale: Locale, key: LegalKey): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `legal.${key}` });
  return pageMetadata({ locale, path: LEGAL_DOCUMENTS[key].path, title: t("title"), description: t("description") });
}

/**
 * A policy page: title band, a sticky table of contents beside the text on wide screens, and the company's current
 * contact details at the end. The policy itself is in English in every language (see content/legal).
 */
export function LegalPage({ docKey }: { docKey: LegalKey }) {
  const t = useTranslations("legal");
  const locale = useLocale();
  const { document } = LEGAL_DOCUMENTS[docKey];
  const headed = document.sections.filter((section) => section.heading);

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t(`${docKey}.title`)} subtitle={t(`${docKey}.subtitle`)} />

      <div className={`${CONTAINER} grid gap-10 py-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-16`}>
        {headed.length > 1 && (
          <nav aria-label={t("onThisPage")} className="hidden lg:block">
            <div className="sticky top-24">
              <p className="eyebrow mb-3">{t("onThisPage")}</p>
              <ol className="flex flex-col gap-2 border-l text-sm text-text-muted">
                {headed.map((section) => (
                  <li key={section.heading}>
                    <a
                      href={`#${sectionId(section.heading!)}`}
                      className="-ml-px block border-l border-transparent pl-4 hover:border-brand hover:text-text"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
        )}

        <div className={`max-w-3xl ${headed.length > 1 ? "" : "lg:col-span-2 lg:mx-auto lg:w-full"}`}>
          {locale !== "en" && (
            <p
              className="mb-8 flex items-start gap-3 rounded-xl border bg-surface-2 p-4 text-sm text-text-muted"
              lang={locale}
            >
              <Icon name="document" className="mt-0.5 h-5 w-5 flex-none" />
              {t("englishOnly")}
            </p>
          )}

          <article lang="en" className="flex flex-col gap-10">
            {document.sections.map((section, index) => (
              <section
                key={section.heading ?? index}
                id={section.heading ? sectionId(section.heading) : undefined}
                className="scroll-mt-24"
              >
                {section.heading && (
                  <h2 className="mb-3 font-display text-xl font-bold sm:text-2xl">{section.heading}</h2>
                )}
                <div className="flex flex-col gap-4 leading-relaxed text-text-muted">
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              </section>
            ))}
            {document.effective && <p className="text-sm text-text-faint">{document.effective}</p>}
          </article>

          <aside className="card mt-12 p-6 sm:p-8" lang={locale}>
            <h2 className="font-display text-xl font-bold">{t("contactTitle")}</h2>
            <p className="mt-1 text-sm text-text-muted">{t("contactBody")}</p>
            <ContactDetails className="mt-6" />
          </aside>
        </div>
      </div>
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "p") return <p className="text-pretty">{block.text}</p>;
  return (
    <ul className="flex flex-col gap-2 pl-1">
      {block.items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2.5 h-1.5 w-1.5 flex-none rounded-full bg-brand" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Company name, address, email and phone, as used on the policy pages and the contact page. */
export function ContactDetails({ className = "" }: { className?: string }) {
  const t = useTranslations("legal");
  const rows = [
    {
      icon: "pin" as const,
      label: t("address"),
      href: COMPANY.address.mapHref,
      external: true,
      value: (
        <address className="not-italic">
          {COMPANY.name}
          <br />
          {COMPANY.address.street}
          <br />
          {COMPANY.address.locality}
        </address>
      ),
    },
    { icon: "mail" as const, label: t("email"), href: COMPANY.email.href, value: COMPANY.email.display },
    { icon: "phone" as const, label: t("phone"), href: COMPANY.phone.href, value: COMPANY.phone.display },
  ];

  return (
    <ul className={`flex flex-wrap gap-x-10 gap-y-5 ${className}`}>
      {rows.map((row) => (
        <li key={row.icon} className="flex items-start gap-3">
          <IconBadge name={row.icon} size="sm" tone="neutral" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{row.label}</p>
            <a
              href={row.href}
              {...(row.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="mt-0.5 block text-text-muted hover:text-brand-text"
            >
              {row.value}
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
