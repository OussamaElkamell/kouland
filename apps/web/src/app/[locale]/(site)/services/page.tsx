import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Icon, IconBadge, Wordmark } from "@kouland/ui";
import { PageIntro, Section } from "@/components/section";
import { SHOWCASE_PLATFORMS } from "@/content/platforms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "servicesPage" });
  return pageMetadata({ locale, path: "/services", title: t("title"), description: t("description") });
}

export default function ServicesPage({ params }: Props) {
  setRequestLocale(use(params).locale as Locale);
  const t = useTranslations("servicesPage");
  const p = useTranslations("platforms");

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("heading")} subtitle={t("subtitle")} />
      <Section>
        <div className="flex flex-col gap-5">
          {SHOWCASE_PLATFORMS.map((platform) => (
            <article key={platform.slug} className="card grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
              <div>
                <div className="flex items-center gap-3">
                  <IconBadge name={platform.icon} />
                  <h2 className="text-2xl">
                    <Wordmark product={platform.product} />
                  </h2>
                </div>
                <p className="mt-4 font-semibold">{p(`${platform.slug}.slogan`)}</p>
                <p className="mt-2 text-text-muted text-pretty">{p(`${platform.slug}.description`)}</p>
              </div>
              <ul className="grid content-start gap-2 text-sm sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {(p.raw(`${platform.slug}.services`) as string[]).map((service) => (
                  <li key={service} className="flex items-center gap-2">
                    <Icon name="check" className="h-4 w-4 flex-none text-brand" strokeWidth={2.6} />
                    {service}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/contact" className="btn btn-primary btn-lg">
            {t("ask")}
          </Link>
        </div>
      </Section>
    </>
  );
}
