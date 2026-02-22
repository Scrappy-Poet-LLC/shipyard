"use client";

import { useEffect, type RefObject } from "react";

/**
 * Focuses the given input when Cmd/Ctrl+F is pressed.
 */
export function useSearchShortcut(
  inputRef: RefObject<HTMLInputElement | null>
): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inputRef]);
}
