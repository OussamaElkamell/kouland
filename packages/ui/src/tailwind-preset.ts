import type { Config } from "tailwindcss";

/**
 * Kouland Tailwind preset. Colours are backed by the CSS variables in styles.css, so light and dark mode
 * (set with `html.dark`) need no Tailwind-side variants for colour.
 */
const preset: Partial<Config> = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: "rgb(var(--color-brand) / <alpha-value>)",
        // Per-platform colours (platform-palettes.css): accent for glows, on-brand for text on the gradient,
        // brand-text for brand-coloured text that must stay readable, silver for the parent's secondary accent.
        "brand-accent": "rgb(var(--color-brand-accent) / <alpha-value>)",
        "on-brand": "rgb(var(--color-on-brand) / <alpha-value>)",
        "brand-text": "rgb(var(--color-brand-text) / <alpha-value>)",
        silver: "rgb(var(--color-silver) / <alpha-value>)",
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        "bg-alt": "rgb(var(--color-bg-alt) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--color-surface-2) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        "text-muted": "rgb(var(--color-text-muted) / <alpha-value>)",
        "text-faint": "rgb(var(--color-text-faint) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        error: "rgb(var(--color-error) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
      },
      // Default border colour for `border` utilities (Tailwind would otherwise use gray-200).
      borderColor: { DEFAULT: "rgb(var(--color-border))" },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        display: ["var(--font-manrope)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        glow: "var(--shadow-glow)",
      },
    },
  },
};

export default preset;
