import type { ReactNode } from "react";
import { CONTAINER } from "@/lib/layout";

/** Page section at the site's width (see CONTAINER). `alt` gives it the alternate background. */
export function Section({ children, className = "", alt = false }: { children: ReactNode; className?: string; alt?: boolean }) {
  return (
    <section className={alt ? "border-y bg-bg-alt" : ""}>
      <div className={`${CONTAINER} py-16 lg:py-20 ${className}`}>{children}</div>
    </section>
  );
}

/** Eyebrow + title + optional subtitle, as used above every section. */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  as: Heading = "h2",
  center = true,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  as?: "h1" | "h2";
  center?: boolean;
}) {
  return (
    <div className={`mb-10 max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <p className="eyebrow mb-3">{eyebrow}</p>
      <Heading className={`font-display font-extrabold tracking-tight text-balance ${Heading === "h1" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"}`}>
        {title}
      </Heading>
      {subtitle && <p className="mt-4 text-text-muted text-pretty">{subtitle}</p>}
    </div>
  );
}

/** Top band of an inner page: glow background + page title. */
export function PageIntro({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="glow-bg border-b">
      <div className={`${CONTAINER} pb-4 pt-16 lg:pt-20`}>
        <SectionHeader as="h1" eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </div>
    </div>
  );
}
