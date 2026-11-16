import type { IconName, MarkMonogram } from "@kouland/ui";

/**
 * The platforms presented on the public website. This list is website content only: the CRM reads its
 * platforms from the database and never depends on these names. Slogans, descriptions and service lists are
 * translated in messages/*.json under `platforms.<slug>`.
 */
export interface ShowcasePlatform {
  slug: "host" | "route" | "bot" | "event" | "tech";
  /** The word after "Kouland" in the name. Brand names are never translated. */
  product: string;
  monogram: MarkMonogram;
  icon: IconName;
}

export const SHOWCASE_PLATFORMS: readonly ShowcasePlatform[] = [
  { slug: "host", product: "Host", monogram: "KH", icon: "server" },
  { slug: "route", product: "Route", monogram: "KR", icon: "truck" },
  { slug: "bot", product: "Bot", monogram: "KB", icon: "message" },
  { slug: "event", product: "Event", monogram: "KE", icon: "calendar" },
  { slug: "tech", product: "Tech", monogram: "KT", icon: "cog" },
];

/** Every platform lives on its own subdomain of the main domain: host.kouland.com, route.kouland.com… */
export function platformUrl(platform: ShowcasePlatform): string {
  return `https://${platform.slug}.kouland.com`;
}
