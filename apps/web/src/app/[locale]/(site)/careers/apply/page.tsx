import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { PageIntro, Section } from "@/components/section";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { ApplicationWizard } from "./application-wizard";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "careers.apply" });
  return {
    ...pageMetadata({ locale, path: "/careers/apply", title: t("title"), description: t("description") }),
    // The form itself is not useful in search results; the careers page is.
    robots: { index: false, follow: true },
  };
}

export default function ApplyPage({ params }: Props) {
  setRequestLocale(use(params).locale as Locale);
  const t = useTranslations("careers.apply");

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("heading")} subtitle={t("subtitle")} />
      <Section>
        {/* The step comes from the URL (?step=…), which is only known in the browser. */}
        <Suspense fallback={<div className="card h-96 animate-pulse" aria-busy="true" />}>
          <ApplicationWizard />
        </Suspense>
      </Section>
    </>
  );
}
