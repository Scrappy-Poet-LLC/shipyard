"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the user's system preference is dark mode.
 * Respects prefers-color-scheme and updates when the preference changes.
 */
export function useColorScheme(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(media.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  return isDark;
}
