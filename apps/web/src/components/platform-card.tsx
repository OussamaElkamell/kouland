import { useTranslations } from "next-intl";
import { HoverCard, Icon, IconBadge, KoulandMark, Wordmark } from "@kouland/ui";
import { platformUrl, type ShowcasePlatform } from "@/content/platforms";

/**
 * One platform in the showcase, neutral at rest. On hover (or keyboard focus) it comes alive in the platform's own
 * colour: the card lifts and leans toward the pointer with a spotlight following the cursor, the mark and product
 * word take the platform gradient, the ticks light up one after another and the icon chip springs up.
 * data-platform supplies the palette and `brand-on-hover` keeps it in the text colour until then.
 * The whole card opens the platform: the Visit link's `after:` layer stretches over the card, so there is still
 * only one link for keyboards and screen readers.
 */
export function PlatformCard({ platform }: { platform: ShowcasePlatform }) {
  const t = useTranslations("platforms");
  const services = t.raw(`${platform.slug}.services`) as string[];

  return (
    <HoverCard
      as="article"
      id={platform.slug}
      data-platform={platform.slug}
      className="brand-on-hover card group relative flex scroll-mt-24 flex-col items-center px-5 pt-6 text-center hover:border-brand/60 focus-within:border-brand/60"
    >
      <KoulandMark monogram={platform.monogram} size={52} />
      <h3 className="mt-4 text-2xl">
        <Wordmark product={platform.product} />
      </h3>
      <p className="mt-1 text-sm font-semibold text-balance">{t(`${platform.slug}.slogan`)}</p>
      <p className="mt-3 text-sm text-text-muted text-pretty">{t(`${platform.slug}.summary`)}</p>

      <ul className="mt-4 flex flex-col gap-1.5 self-stretch text-left text-sm">
        {services.map((service, index) => (
          <li key={service} className="flex items-center gap-2">
            <Icon name="check" className="hover-check h-4 w-4 flex-none text-text-faint" strokeWidth={2.6} style={{ "--i": index }} />
            {service}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col items-center gap-4 self-stretch pb-6 pt-6">
        <IconBadge name={platform.icon} size="lg" tone="neutral" className="hover-chip" />
        <a
          href={platformUrl(platform)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm after:absolute after:inset-0 after:rounded-lg after:content-[''] group-hover:border-brand/60 group-hover:text-brand-text"
        >
          {t("visit", { name: `Kouland${platform.product}` })}
          <Icon name="arrow" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </a>
      </div>
    </HoverCard>
  );
}
