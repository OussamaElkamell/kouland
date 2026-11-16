"use client";

import { useEffect, useLayoutEffect } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The inline script in <head> applies the saved theme on a full page load. Switching language is a client-side
 * navigation that re-renders <html> with the server default (`dark`), so the saved choice is applied again here,
 * before paint.
 */
export function ThemeSync() {
  useIsomorphicLayoutEffect(() => {
    try {
      const light = window.localStorage.getItem(THEME_STORAGE_KEY) === "light";
      document.documentElement.classList.toggle("dark", !light);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);
  return null;
}
