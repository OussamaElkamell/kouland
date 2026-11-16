"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export function ThemeToggle() {
  const t = useTranslations("nav");

  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      /* private mode: the theme still applies for this page view */
    }
  }

  // The icons are swapped with CSS (`dark:` variant), so there is no hydration flicker.
  return (
    <button type="button" onClick={toggle} className="btn btn-ghost btn-sm !px-2.5" aria-label={t("theme")} title={t("theme")}>
      <Icon name="sun" className="w-[1.125rem] h-[1.125rem] hidden dark:block" />
      <Icon name="moon" className="w-[1.125rem] h-[1.125rem] dark:hidden" />
    </button>
  );
}
