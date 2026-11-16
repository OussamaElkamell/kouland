import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { IconBadge } from "@kouland/ui";
import { PageIntro, Section, SectionHeader } from "@/components/section";
import { COMPANY, VALUES } from "@/content/company";
import { SHOWCASE_PLATFORMS } from "@/content/platforms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };
const YEAR = String(COMPANY.foundedYear);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  return pageMetadata({ locale, path: "/about", title: t("title"), description: t("description", { year: YEAR }) });
}

export default function AboutPage({ params }: Props) {
  setRequestLocale(use(params).locale as Locale);
  const t = useTranslations();

  const facts = [
    { value: YEAR, label: t("aboutPage.facts.since") },
    { value: String(SHOWCASE_PLATFORMS.length), label: t("aboutPage.facts.platforms") },
    { value: t("aboutPage.facts.customersValue"), label: t("aboutPage.facts.customers") },
  ];

  return (
    <>
      <PageIntro eyebrow={t("aboutPage.eyebrow")} title={t("aboutPage.heading")} subtitle={t("aboutPage.subtitle", { year: YEAR })} />

      <Section>
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-start">
          <div className="space-y-4 text-text-muted text-pretty">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-text">{t("aboutPage.storyTitle")}</h2>
            <p>{t("aboutPage.story1")}</p>
            <p>{t("aboutPage.story2")}</p>
            <p>{t("aboutPage.story3")}</p>
          </div>
          <dl className="card divide-y">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col-reverse p-5">
                <dt className="text-sm text-text-muted">{fact.label}</dt>
                <dd className="mb-1 font-display text-2xl font-extrabold gradient-text-brand">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section alt>
        <SectionHeader eyebrow={t("aboutPage.valuesEyebrow")} title={t("aboutPage.valuesTitle")} />
        <div className="grid gap-5 md:grid-cols-3">
          {VALUES.map((value) => (
            <div key={value.key} className="card p-6">
              <IconBadge name={value.icon} />
              <h3 className="mt-4 font-display text-lg font-bold">{t(`values.${value.key}.title`)}</h3>
              <p className="mt-2 text-sm text-text-muted">{t(`values.${value.key}.body`)}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/contact" className="btn btn-primary btn-lg">
            {t("aboutPage.cta")}
          </Link>
        </div>
      </Section>
    </>
  );
}
