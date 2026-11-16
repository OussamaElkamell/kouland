import { useId } from "react";

/**
 * The Kouland mark: a rounded rectangle with a thick brand-gradient outline and a heavy two-letter monogram
 * (K + the product initial) whose letters touch. The parent mark (Kouland Technology, "KT" with `notched`)
 * has two diagonal cuts in the outline. Letters are custom paths, never a font.
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

export interface KoulandMarkProps {
  monogram: MarkMonogram;
  /** Height in pixels; the width follows the 44:32 shape. */
  size?: number;
  /** Parent-company mark: two diagonal cuts in the outline. */
  notched?: boolean;
  /** Soft brand glow behind the mark. */
  glow?: boolean;
  className?: string;
}

export function KoulandMark({ monogram, size = 40, notched = false, glow = false, className = "" }: KoulandMarkProps) {
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
  const maskId = `${id}-m`;

  return (
    <svg
      className={`flex-none ${className}`}
      width={Math.round((size * 44) / 32)}
      height={size}
      viewBox="0 0 44 32"
      role="img"
      aria-label={`${monogram} logo`}
      style={glow ? { overflow: "visible", filter: "drop-shadow(0 0 6px rgb(0 161 111 / 0.55)) drop-shadow(0 0 18px rgb(0 161 111 / 0.3))" } : undefined}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00AC76" />
          <stop offset="0.5" stopColor="#009FA0" />
          <stop offset="1" stopColor="#0085B9" />
        </linearGradient>
        {notched && (
          <mask id={maskId}>
            <rect x="-2" y="-2" width="48" height="36" fill="#fff" />
            <path d="M26.2 -1L29.4 -1L27 5L23.8 5Z" fill="#000" />
            <path d="M16.6 27L19.8 27L17.4 33L14.2 33Z" fill="#000" />
          </mask>
        )}
      </defs>
      <rect x="2" y="2" width="40" height="28" rx="8" fill="rgb(var(--color-surface))" />
      <rect
        x="2"
        y="2"
        width="40"
        height="28"
        rx="8"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3.4"
        mask={notched ? `url(#${maskId})` : undefined}
      />
      <g fill="rgb(var(--color-text))" transform={`translate(${tx.toFixed(2)} ${ty}) scale(${SCALE.toFixed(4)})`}>
        <path fillRule="evenodd" d={first[1]} />
        <path fillRule="evenodd" transform={`translate(${offset} 0)`} d={other[1]} />
      </g>
    </svg>
  );
}

/** "Kouland" in the text colour + the product word in the brand gradient. */
export function Wordmark({ product, className = "" }: { product: string; className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      Kouland<span className="gradient-text-brand">{product}</span>
    </span>
  );
}
