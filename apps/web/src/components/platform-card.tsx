import { useTranslations } from "next-intl";
import { Icon, IconBadge, KoulandMark, Wordmark } from "@kouland/ui";
import { platformUrl, type ShowcasePlatform } from "@/content/platforms";

/**
 * One platform in the showcase. Every card uses the same brand colours; platforms differ by name, mark and icon.
 * The whole card opens the platform: the Visit link's `after:` layer stretches over the card, so there is still
 * only one link for keyboards and screen readers.
 */
export function PlatformCard({ platform }: { platform: ShowcasePlatform }) {
  const t = useTranslations("platforms");
  const services = t.raw(`${platform.slug}.services`) as string[];

  return (
    <article
      id={platform.slug}
      className="card card-hover group relative flex scroll-mt-24 flex-col items-center border-brand/40 px-5 pt-6 text-center transition-colors hover:border-brand focus-within:border-brand"
    >
      <KoulandMark monogram={platform.monogram} size={52} glow />
      <h3 className="mt-4 text-2xl">
        <Wordmark product={platform.product} />
      </h3>
      <p className="mt-1 text-sm font-semibold text-balance">{t(`${platform.slug}.slogan`)}</p>
      <p className="mt-3 text-sm text-text-muted text-pretty">{t(`${platform.slug}.summary`)}</p>

      <ul className="mt-4 flex flex-col gap-1.5 self-stretch text-left text-sm">
        {services.map((service) => (
          <li key={service} className="flex items-center gap-2">
            <Icon name="check" className="h-4 w-4 flex-none text-brand" strokeWidth={2.6} />
            {service}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col items-center gap-4 self-stretch pb-6 pt-6">
        <IconBadge name={platform.icon} size="lg" />
        <a
          href={platformUrl(platform)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm after:absolute after:inset-0 after:rounded-lg after:content-[''] group-hover:border-brand group-hover:text-brand"
        >
          {t("visit", { name: `Kouland${platform.product}` })}
          <Icon name="arrow" className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}
