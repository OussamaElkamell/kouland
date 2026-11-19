import { useId } from "react";

/**
 * A Kouland product mark: a rounded rectangle with a thick outline in the platform's own gradient and a heavy
 * two-letter monogram (K + the product initial) whose letters touch. Letters are custom paths, never a font.
 * The mark sets data-platform on itself, so its gradient and glow come from that platform's palette
 * (platform-palettes.css) wherever it is placed. The parent company uses its own house logo, not this mark.
 */
const GLYPHS: Record<string, readonly [width: number, path: string]> = {
  K: [17, "M0 0H5V6.6L10.6 0H16.8L9.2 8.7L17 18H10.8L5 11.1V18H0Z"],
  H: [15, "M0 0H5V6.6H10V0H15V18H10V11.4H5V18H0Z"],
  T: [16, "M0 0H16V4.8H10.5V18H5.5V4.8H0Z"],
  E: [14, "M0 0H14V4.5H5V6.8H12.6V11.2H5V13.5H14V18H0Z"],
  R: [15.8, "M0 0H9.4C13.1 0 15.2 2.3 15.2 5.5C15.2 7.9 13.9 9.7 11.8 10.5L15.8 18H10.2L6.8 11.1H5V18H0ZM5 4.4V6.7H9C9.8 6.7 10.3 6.2 10.3 5.55C10.3 4.9 9.8 4.4 9 4.4Z"],
  B: [15.6, "M0 0H9.6C12.9 0 14.7 1.9 14.7 4.5C14.7 6.3 13.8 7.6 12.5 8.3C14.5 9 15.6 10.6 15.6 12.8C15.6 16 13.3 18 9.9 18H0ZM5 4.2V7.1H8.9C9.7 7.1 10.1 6.5 10.1 5.65C10.1 4.8 9.7 4.2 8.9 4.2ZM5 10.9V13.8H9.4C10.3 13.8 10.8 13.2 10.8 12.35C10.8 11.5 10.3 10.9 9.4 10.9Z"],
};

/** Where the second letter starts. K is 17 wide, so a smaller value makes the letters touch. */
const JOIN: Record<string, number> = { T: 12.6 };
const DEFAULT_JOIN = 15.2;
const SCALE = 19 / 18;

export type MarkMonogram = "KT" | "KH" | "KR" | "KB" | "KE";
export type PlatformKey = "host" | "route" | "bot" | "event" | "tech";

/** The platform (and so the palette) of each product monogram. */
export const PLATFORM_OF_MONOGRAM: Record<MarkMonogram, PlatformKey> = { KH: "host", KR: "route", KB: "bot", KE: "event", KT: "tech" };

export interface KoulandMarkProps {
  monogram: MarkMonogram;
  /** Height in pixels; the width follows the 44:32 shape. */
  size?: number;
  /** Soft glow in the platform's accent colour. */
  glow?: boolean;
  className?: string;
}

export function KoulandMark({ monogram, size = 40, glow = false, className = "" }: KoulandMarkProps) {
  const id = useId();
  const second = monogram[1] ?? "T";
  const first = GLYPHS.K;
  const other = GLYPHS[second];
  if (!first || !other) return null;

  const offset = JOIN[second] ?? DEFAULT_JOIN;
  const glyphWidth = (offset + other[0]) * SCALE;
  const tx = (44 - glyphWidth) / 2;
  const ty = (32 - 19) / 2;
  const gradientId = `${id}-g`;

  return (
    <svg
      data-platform={PLATFORM_OF_MONOGRAM[monogram]}
      className={`flex-none ${className}`}
      width={Math.round((size * 44) / 32)}
      height={size}
      viewBox="0 0 44 32"
      role="img"
      aria-label={`${monogram} logo`}
      style={
        glow
          ? {
              overflow: "visible",
              filter: "drop-shadow(0 0 6px rgb(var(--color-brand-accent) / 0.55)) drop-shadow(0 0 18px rgb(var(--color-brand-accent) / 0.3))",
            }
          : undefined
      }
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "rgb(var(--brand-g1))" }} />
          <stop offset="0.5" style={{ stopColor: "rgb(var(--brand-g2))" }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--brand-g3))" }} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="40" height="28" rx="8" fill="rgb(var(--color-surface))" />
      <rect x="2" y="2" width="40" height="28" rx="8" fill="none" stroke={`url(#${gradientId})`} strokeWidth="3.4" />
      <g fill="rgb(var(--color-text))" transform={`translate(${tx.toFixed(2)} ${ty}) scale(${SCALE.toFixed(4)})`}>
        <path fillRule="evenodd" d={first[1]} />
        <path fillRule="evenodd" transform={`translate(${offset} 0)`} d={other[1]} />
      </g>
    </svg>
  );
}

/** "Kouland" in the text colour + the product word in the gradient of the surrounding platform palette. */
export function Wordmark({ product, className = "" }: { product: string; className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      Kouland<span className="wordmark-product gradient-text-brand">{product}</span>
    </span>
  );
}
