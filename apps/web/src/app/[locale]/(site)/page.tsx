import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Icon, IconBadge } from "@kouland/ui";
import { NetworkGlobe } from "@/components/network-globe";
import { PlatformCard } from "@/components/platform-card";
import { Section, SectionHeader } from "@/components/section";
import { COMPANY, PILLARS, VALUES } from "@/content/company";
import { GUARANTEES, HERO_TILES, POPULAR_SERVICES, STATS, TESTIMONIALS } from "@/content/home";
import { photo } from "@/content/images";
import { platformUrl, SHOWCASE_PLATFORMS } from "@/content/platforms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { CONTAINER } from "@/lib/layout";

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale(use(params).locale as Locale);
  const t = useTranslations("home");

  return (
    <>
      <Hero />
      <Guarantees />
      <AboutIntro />

      <Section>
        <SectionHeader eyebrow={t("platforms.eyebrow")} title={t("platforms.title")} subtitle={t("platforms.subtitle")} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {SHOWCASE_PLATFORMS.map((platform) => (
            <PlatformCard key={platform.slug} platform={platform} />
          ))}
        </div>
      </Section>

      <PopularServices />
      <Values />
      <Testimonials />
      <SatisfactionBand />
    </>
  );
}

function Hero() {
  const t = useTranslations();
  return (
    <section className="glow-bg relative overflow-hidden border-b">
      {/*
        Sits in the top-right corner, clear of the photos (the mosaic is capped in width and centred in its column).
        Below 1536px there is not enough room beside the photos, so it is hidden rather than drawn behind them.
      */}
      <NetworkGlobe className="pointer-events-none absolute -right-60 -top-60 hidden h-[28rem] w-[28rem] opacity-50 dark:opacity-80 2xl:block" />
      <div className={`${CONTAINER} relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24`}>
        <div>
          <p className="eyebrow mb-4">{COMPANY.name}</p>
          <h1 className="max-w-3xl font-display text-4xl font-extrabold tracking-tight text-balance sm:text-5xl xl:text-6xl">
            {t("home.hero.titleStart")} <span className="gradient-text-brand">{t("home.hero.titleEnd")}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-text-muted text-pretty">
            {t("company.claim")} {t("home.hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/platforms" className="btn btn-primary btn-lg">
              {t("home.hero.explore")}
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="btn btn-outline btn-lg">
              {t("home.hero.talk")}
            </Link>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
            {PILLARS.map((pillar) => (
              <li key={pillar} className="flex items-center gap-2">
                <span className="gradient-brand h-1.5 w-1.5 rounded-full" />
                {t(`company.pillars.${pillar}`)}
              </li>
            ))}
          </ul>
        </div>
        <HeroMosaic />
      </div>
    </section>
  );
}

/**
 * Five photos, one per platform, each labelled with the platform's name and linking to it (new tab): two wide
 * tiles on the first row and three tall ones on the second (a six-column grid, so 3 + 3 and then 2 + 2 + 2).
 */
function HeroMosaic() {
  const t = useTranslations("platforms");
  return (
    <nav aria-label={t("heroLabel")} className="grid w-full max-w-[34rem] grid-cols-6 gap-3 justify-self-center sm:gap-4">
      {HERO_TILES.map((tile, index) => {
        const wide = index < 2;
        const platform = SHOWCASE_PLATFORMS.find((p) => p.slug === tile.slug);
        if (!platform) return null;
        const name = `Kouland${platform.product}`;
        return (
          <a
            key={tile.slug}
            href={platformUrl(platform)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("visit", { name })}
            className={`group relative overflow-hidden rounded-xl border shadow-lift transition duration-200 hover:-translate-y-1 hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
              wide ? "col-span-3 aspect-[5/4]" : "col-span-2 aspect-[3/4]"
            }`}
          >
            <Image
              src={wide ? photo(tile.photo, 640, 512) : photo(tile.photo, 450, 600)}
              alt=""
              fill
              sizes={wide ? "(min-width: 1024px) 260px, 50vw" : "(min-width: 1024px) 170px, 33vw"}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              priority={wide}
            />
            {/* Darkens the bottom so the label stays readable on any photo. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
            <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 font-display text-xs font-extrabold tracking-tight text-white backdrop-blur sm:text-sm">
              Kouland<span className="gradient-text-brand">{platform.product}</span>
              <Icon name="arrow" className="h-3.5 w-3.5 -rotate-45 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
          </a>
        );
      })}
    </nav>
  );
}

/** The three guarantees, directly under the hero. */
function Guarantees() {
  const t = useTranslations("home.guarantees");
  return (
    <section className="border-b bg-bg-alt">
      <ul className={`${CONTAINER} grid gap-6 py-8 md:grid-cols-3`}>
        {GUARANTEES.map((item) => (
          <li key={item.key} className="flex items-start gap-4">
            <IconBadge name={item.icon} size="sm" />
            <div>
              <h2 className="font-display font-bold">{t(`${item.key}.title`)}</h2>
              <p className="mt-0.5 text-sm text-text-muted">{t(`${item.key}.body`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AboutIntro() {
  const t = useTranslations("home");
  const locale = useLocale();
  const count = new Intl.NumberFormat(locale);
  const statValue = (stat: (typeof STATS)[number]) =>
    stat.kind === "year" ? String(stat.value) : stat.kind === "count" ? `${count.format(stat.value)}+` : count.format(stat.value);

  return (
    <Section>
      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">{t("intro.eyebrow")}</p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            {t("intro.title", { year: String(COMPANY.foundedYear) })}
          </h2>
          <p className="mt-4 text-text-muted text-pretty">{t("intro.body1")}</p>
          <p className="mt-3 text-text-muted text-pretty">{t("intro.body2")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/about" className="btn btn-secondary">
              {t("intro.more")}
            </Link>
            <Link href="/services" className="btn btn-outline">
              {t("intro.services")}
            </Link>
          </div>
        </div>
        {/* Capped in width like the hero photos, so it does not grow with wide screens. */}
        <div className="w-full max-w-[32rem] justify-self-center">
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl border shadow-lift">
            <Image src={photo("team", 900, 560)} alt="" fill sizes="(min-width: 768px) 512px, 100vw" className="object-cover" />
          </div>
          {/* The figures overlap the bottom of the photo. */}
          <dl className="relative -mt-12 grid grid-cols-2 gap-3 px-4 sm:px-6">
            {STATS.map((stat) => (
              <div key={stat.key} className="card flex flex-col-reverse px-5 py-4">
                <dt className="mt-1 text-sm text-text-muted">{t(`stats.${stat.key}`)}</dt>
                <dd className="font-display text-3xl font-extrabold gradient-text-brand">{statValue(stat)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  );
}

function PopularServices() {
  const t = useTranslations("home.popular");
  return (
    <Section alt>
      <SectionHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {POPULAR_SERVICES.map((service) => (
          <article key={service.key} className="card card-hover overflow-hidden">
            <div className="relative aspect-[16/9]">
              <Image src={photo(service.photo, 640, 360)} alt="" fill sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
            </div>
            <div className="relative px-6 pb-6">
              {/* The icon sits half over the photo. */}
              <IconBadge name={service.icon} className="-mt-6 ring-4 ring-[rgb(var(--color-surface))]" />
              <h3 className="mt-3 font-display text-lg font-bold">{t(`${service.key}.title`)}</h3>
              <p className="mt-1 text-sm text-text-muted">{t(`${service.key}.body`)}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link href="/services" className="btn btn-primary">
          {t("all")}
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </Section>
  );
}

function Values() {
  const t = useTranslations();
  return (
    <Section>
      <SectionHeader eyebrow={t("home.why.eyebrow")} title={t("home.why.title")} />
      <div className="grid gap-5 md:grid-cols-3">
        {VALUES.map((value) => (
          <div key={value.key} className="card p-6">
            <IconBadge name={value.icon} />
            <h3 className="mt-4 font-display text-lg font-bold">{t(`values.${value.key}.title`)}</h3>
            <p className="mt-2 text-sm text-text-muted">{t(`values.${value.key}.body`)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Testimonials() {
  const t = useTranslations("home.testimonials");
  return (
    <Section alt>
      <SectionHeader eyebrow={t("eyebrow")} title={t("title")} />
      <div className="grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((item) => (
          <figure key={item.key} className="card flex flex-col p-6">
            <div className="flex gap-0.5 text-brand" role="img" aria-label={t("rating")}>
              {[0, 1, 2, 3, 4].map((star) => (
                <Icon key={star} name="star" className="h-4 w-4 fill-current" strokeWidth={0} />
              ))}
            </div>
            <blockquote className="mt-4 flex-1 text-sm text-pretty">“{t(`${item.key}.quote`)}”</blockquote>
            <figcaption className="mt-5 border-t pt-4">
              <span className="block font-display font-bold">{item.name}</span>
              <span className="block text-xs text-text-muted">{t(`${item.key}.role`)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

/** Customer-satisfaction statement with the closing call to action. */
function SatisfactionBand() {
  const t = useTranslations();
  return (
    <Section>
      <div className="card glow-bg grid overflow-hidden md:grid-cols-[1.4fr_1fr]">
        <div className="p-8 lg:p-10">
          <p className="eyebrow mb-3">{t("home.satisfaction.eyebrow")}</p>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">{t("home.satisfaction.title")}</h2>
          <p className="mt-3 text-text-muted text-pretty">{t("home.satisfaction.body")}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/contact" className="btn btn-primary btn-lg">
              {t("nav.contactUs")}
            </Link>
            <a href={COMPANY.phone.href} className="flex items-center gap-2 text-sm font-semibold hover:text-brand">
              <Icon name="phone" className="h-4 w-4" />
              {COMPANY.phone.display}
            </a>
          </div>
        </div>
        <div className="relative min-h-56 md:min-h-full">
          <Image src={photo("handshake", 700, 600)} alt="" fill sizes="(min-width: 768px) 420px, 100vw" className="object-cover" />
          {/* Blends the photo's left edge into the card on wide screens. */}
          <div className="absolute inset-0 bg-gradient-to-r from-[rgb(var(--color-surface))] via-transparent to-transparent max-md:hidden" />
        </div>
      </div>
    </Section>
  );
}
