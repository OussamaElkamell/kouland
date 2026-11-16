import { KoulandMark } from "@kouland/ui";

/**
 * Parent-company lockup: the notched KT mark + "Kouland Technology, Inc."
 * The two text lines are sized so that together they are as tall as the mark: the top of "Kouland" lines up
 * with the top of the mark and the bottom of "Technology, Inc." with its bottom. Each line sets its own line
 * height (`leading-none`), because Tailwind's text-size classes would otherwise add space between them.
 */
export function CompanyLogo() {
  return (
    <span className="flex items-center gap-2.5">
      <KoulandMark monogram="KT" notched size={32} />
      <span className="flex -translate-y-px flex-col font-display font-extrabold tracking-tight">
        <span className="text-xl leading-none">Kouland</span>
        <span className="gradient-text-brand -mb-[0.1em] text-[0.8125rem] leading-none">Technology, Inc.</span>
      </span>
    </span>
  );
}
