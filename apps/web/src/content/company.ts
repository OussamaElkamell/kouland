import type { IconName } from "@kouland/ui";

/**
 * Company facts shown on the public website. Text that visitors read is translated in messages/*.json;
 * this file only holds what is the same in every language.
 */
export const COMPANY = {
  name: "Kouland Technology, Inc.",
  shortName: "Kouland",
  foundedYear: 2015,
  phone: { display: "1 (918) 704-7676", href: "tel:+19187047676" },
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100",
} as const;

/** Keys into `company.pillars` in the messages. */
export const PILLARS = ["one", "two", "three"] as const;

/** Keys into `values` in the messages. */
export const VALUES: ReadonlyArray<{ key: "reliable" | "innovative" | "customer"; icon: IconName }> = [
  { key: "reliable", icon: "shield" },
  { key: "innovative", icon: "bulb" },
  { key: "customer", icon: "users" },
];

/** Main navigation; labels are `nav.<key>` in the messages. */
export const NAV_LINKS = [
  { href: "/platforms", key: "platforms" },
  { href: "/services", key: "services" },
  { href: "/about", key: "about" },
] as const;
