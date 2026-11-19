import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { IconBadge } from "@kouland/ui";
import { PageIntro, Section } from "@/components/section";
import { COMPANY } from "@/content/company";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { SupportForm } from "./support-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "supportPage" });
  return pageMetadata({ locale, path: "/support", title: t("title"), description: t("description") });
}

/** "Report an issue": a customer reports a problem; it becomes a support ticket in the CRM. */
export default function SupportPage({ params }: Props) {
  setRequestLocale(use(params).locale as Locale);
  const t = useTranslations("supportPage");

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("heading")} subtitle={t("subtitle")} />
      <Section>
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-start">
          <div className="card p-6 sm:p-8">
            <SupportForm />
          </div>
          <aside className="flex flex-col gap-4">
            <div className="card flex items-start gap-4 p-6">
              <IconBadge name="clock" />
              <div>
                <h2 className="font-display text-lg font-bold">{t("whatNextTitle")}</h2>
                <p className="mt-1 text-sm text-text-muted">{t("whatNextBody")}</p>
              </div>
            </div>
            <div className="card flex items-start gap-4 p-6">
              <IconBadge name="phone" />
              <div>
                <h2 className="font-display text-lg font-bold">{t("urgentTitle")}</h2>
                <p className="mt-1 text-sm text-text-muted">{t("urgentBody")}</p>
                <a href={COMPANY.phone.href} className="mt-2 inline-block font-semibold text-brand-text hover:underline">
                  {COMPANY.phone.display}
                </a>
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
