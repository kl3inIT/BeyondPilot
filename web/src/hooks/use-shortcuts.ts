"use client";

import { useEffect, useRef } from "react";

/** How long a page is shown before its keys act, so a key meant for the last page does not decide this one. */
const ARMING_DELAY_MS = 1000;

/**
 * Single-key shortcuts of a page, by lowercase key. A key does nothing while a person types in a
 * field, holds a modifier, or has a dialog open; a key held down acts once, and none acts in the first second of a
 * page; a key without a handler is left to the browser.
 */
export function useShortcuts(keys: Record<string, (() => void) | undefined>) {
  const current = useRef(keys);

  useEffect(() => {
    current.current = keys;
  });

  useEffect(() => {
    const armedAt = performance.now() + ARMING_DELAY_MS;
    function press(event: KeyboardEvent) {
      const typing =
        event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]") !== null;
      const busy =
        performance.now() < armedAt ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        typing ||
        document.querySelector("[role=dialog], [role=alertdialog]") !== null;
      const run = busy ? undefined : current.current[event.key.toLowerCase()];
      if (run) {
        event.preventDefault();
        run();
      }
    }
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, []);
}
