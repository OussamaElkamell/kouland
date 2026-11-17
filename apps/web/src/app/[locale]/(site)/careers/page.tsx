import type { Metadata } from "next";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { APPLICATION_AREAS } from "@kouland/contracts";
import { Icon, IconBadge, KoulandMark, type IconName } from "@kouland/ui";
import { PageIntro, Section, SectionHeader } from "@/components/section";
import { photo } from "@/content/images";
import { SHOWCASE_PLATFORMS } from "@/content/platforms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

const BENEFITS: ReadonlyArray<{ key: "impact" | "growth" | "team" | "flexible"; icon: IconName }> = [
  { key: "impact", icon: "users" },
  { key: "growth", icon: "chart" },
  { key: "team", icon: "globe" },
  { key: "flexible", icon: "clock" },
];
const PROCESS = ["apply", "review", "interview", "welcome"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "careers.page" });
  return pageMetadata({ locale, path: "/careers", title: t("title"), description: t("description") });
}

export default function CareersPage({ params }: Props) {
  setRequestLocale(use(params).locale as Locale);
  const t = useTranslations("careers.page");
  const areas = useTranslations("careers.apply.options");

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("heading")} subtitle={t("subtitle")} />

      <Section>
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance">{t("introTitle")}</h2>
            <p className="mt-4 text-text-muted text-pretty">{t("introBody")}</p>
            <Link href="/careers/apply" className="btn btn-primary btn-lg mt-6">
              {t("apply")}
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative aspect-[16/10] w-full max-w-[32rem] justify-self-center overflow-hidden rounded-xl border shadow-lift">
            <Image src={photo("team", 900, 560)} alt="" fill sizes="(min-width: 768px) 512px, 100vw" className="object-cover" priority />
          </div>
        </div>
      </Section>

      <Section alt>
        <SectionHeader eyebrow={t("whyEyebrow")} title={t("whyTitle")} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <div key={benefit.key} className="card p-6">
              <IconBadge name={benefit.icon} />
              <h3 className="mt-4 font-display text-lg font-bold">{t(`benefits.${benefit.key}.title`)}</h3>
              <p className="mt-2 text-sm text-text-muted">{t(`benefits.${benefit.key}.body`)}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow={t("teamsEyebrow")} title={t("teamsTitle")} subtitle={t("teamsSubtitle")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {APPLICATION_AREAS.map((area) => {
            const platform = SHOWCASE_PLATFORMS.find((item) => item.slug === area);
            return (
              <div key={area} className="card flex items-start gap-4 p-5">
                {platform ? <KoulandMark monogram={platform.monogram} size={36} /> : <KoulandMark monogram="KT" notched size={36} />}
                <div>
                  <h3 className="font-display font-bold">{areas(`area.${area}`)}</h3>
                  <p className="mt-1 text-sm text-text-muted">{areas(`areaHint.${area}`)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section alt>
        <SectionHeader eyebrow={t("processEyebrow")} title={t("processTitle")} />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((step, index) => (
            <li key={step} className="card p-6">
              <span className="step-dot current">{index + 1}</span>
              <h3 className="mt-4 font-display text-lg font-bold">{t(`process.${step}.title`)}</h3>
              <p className="mt-2 text-sm text-text-muted">{t(`process.${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <div className="card glow-bg flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center lg:p-10">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{t("ctaTitle")}</h2>
            <p className="mt-2 max-w-xl text-text-muted">{t("ctaBody")}</p>
          </div>
          <Link href="/careers/apply" className="btn btn-primary btn-lg flex-none">
            {t("apply")}
          </Link>
        </div>
      </Section>
    </>
  );
}
