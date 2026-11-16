import type { IconName } from "@kouland/ui";
import { COMPANY } from "./company";
import type { PhotoName } from "./images";
import { SHOWCASE_PLATFORMS, type ShowcasePlatform } from "./platforms";

/**
 * Home page structure. The text is translated in messages/*.json under `home.*`. The guarantees, figures,
 * popular services and customer quotes come from the previous company website (koulandtechnology.com) and
 * were confirmed for publication on 2026-11-16.
 */
export const GUARANTEES: ReadonlyArray<{ key: "trusted" | "booking" | "guarantee"; icon: IconName }> = [
  { key: "trusted", icon: "shield" },
  { key: "booking", icon: "calendar" },
  { key: "guarantee", icon: "check" },
];

/** `year` is shown as is; `count` is formatted for the visitor's language (3,900 / 3 900) and gets a "+". */
export const STATS: ReadonlyArray<{ key: "since" | "customers" | "members" | "platforms"; value: number; kind: "year" | "count" | "exact" }> = [
  { key: "since", value: COMPANY.foundedYear, kind: "year" },
  { key: "customers", value: 3900, kind: "count" },
  { key: "members", value: 2500, kind: "count" },
  { key: "platforms", value: SHOWCASE_PLATFORMS.length, kind: "exact" },
];

export const POPULAR_SERVICES: ReadonlyArray<{ key: "it" | "phone" | "security" | "tv" | "wifi" | "remote"; icon: IconName; photo: PhotoName }> = [
  { key: "it", icon: "cog", photo: "itOffice" },
  { key: "phone", icon: "mobile", photo: "phoneRepair" },
  { key: "security", icon: "lock", photo: "smartLock" },
  { key: "tv", icon: "screen", photo: "tvWall" },
  { key: "wifi", icon: "wifi", photo: "router" },
  { key: "remote", icon: "support", photo: "remoteAgent" },
];

/** Hero photo mosaic: one photo per platform, in the order shown. Two on the first row, three on the second. */
export const HERO_TILES: ReadonlyArray<{ photo: PhotoName; slug: ShowcasePlatform["slug"] }> = [
  { photo: "webDeveloper", slug: "host" },
  { photo: "truck", slug: "route" },
  { photo: "supportAgent", slug: "bot" },
  { photo: "event", slug: "event" },
  { photo: "technician", slug: "tech" },
];

/** Customer names are not translated; quotes and roles are, under `home.testimonials.<key>`. */
export const TESTIMONIALS: ReadonlyArray<{ key: "paula" | "jasmine" | "corey"; name: string }> = [
  { key: "paula", name: "Paula Smith" },
  { key: "jasmine", name: "Jasmine Cloe" },
  { key: "corey", name: "Corey & Nancy" },
];
