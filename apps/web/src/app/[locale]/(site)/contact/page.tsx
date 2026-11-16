import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { IconBadge } from "@kouland/ui";
import { PageIntro, Section } from "@/components/section";
import { COMPANY } from "@/content/company";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { ContactForm } from "./contact-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "contactPage" });
  return pageMetadata({ locale, path: "/contact", title: t("title"), description: t("description") });
}

export default function ContactPage({ params }: Props) {
  setRequestLocale(use(params).locale as Locale);
  const t = useTranslations("contactPage");

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("heading")} subtitle={t("subtitle")} />
      <Section>
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-start">
          <div className="card p-6 sm:p-8">
            <ContactForm />
          </div>
          <aside className="card flex items-start gap-4 p-6">
            <IconBadge name="phone" />
            <div>
              <h2 className="font-display text-lg font-bold">{t("callTitle")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("callBody")}</p>
              <a href={COMPANY.phone.href} className="mt-2 inline-block font-semibold text-brand hover:underline">
                {COMPANY.phone.display}
              </a>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
