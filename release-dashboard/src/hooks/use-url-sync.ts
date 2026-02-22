"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Returns a function to update the URL query string without navigation.
 */
export function useUrlSync(): (updates: Record<string, string>) => void {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    },
    [pathname, searchParams]
  );
}
