import type { ShowcasePlatform } from "@/content/platforms";

/**
 * A platform's name as text, e.g. KoulandHost: "Kouland" in the surrounding colour and the product word in the
 * platform's own colour (the readable brand-text tone of its palette, set by data-platform on the span).
 */
export function PlatformName({ platform }: { platform: Pick<ShowcasePlatform, "slug" | "product"> }) {
  return (
    <>
      Kouland
      <span data-platform={platform.slug} className="text-brand-text">
        {platform.product}
      </span>
    </>
  );
}
