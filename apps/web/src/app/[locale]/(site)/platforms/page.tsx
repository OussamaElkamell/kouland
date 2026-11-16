import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { PlatformCard } from "@/components/platform-card";
import { PageIntro, Section } from "@/components/section";
import { SHOWCASE_PLATFORMS } from "@/content/platforms";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "platformsPage" });
  return pageMetadata({ locale, path: "/platforms", title: t("title"), description: t("description") });
}

export default function PlatformsPage({ params }: Props) {
  setRequestLocale(use(params).locale as Locale);
  const t = useTranslations("platformsPage");

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("heading")} subtitle={t("subtitle")} />
      <Section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {SHOWCASE_PLATFORMS.map((platform) => (
            <PlatformCard key={platform.slug} platform={platform} />
          ))}
        </div>
      </Section>
    </>
  );
}
