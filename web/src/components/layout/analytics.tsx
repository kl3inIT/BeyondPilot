"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { usePathname } from "@/i18n/navigation";
import { isTrackedPath } from "@/lib/analytics";
import { analyticsMeasurementId, siteOrigin } from "@/lib/site";

const subscribe = () => () => {};

/**
 * Opens the current page as a new document that has no referrer. A plain reload would name this
 * private address as the referrer, and Google Analytics would report it from the next public page.
 */
function openWithoutReferrer() {
  const link = document.createElement("a");
  link.href = window.location.pathname + window.location.search;
  link.rel = "noreferrer";
  link.click();
}

/**
 * Google Analytics 4 for the public pages of the public address only. Staging and a local run
 * serve the same build, so the browser decides by its host when it hydrates; on any other host,
 * and on a page `isTrackedPath` refuses, nothing is loaded or sent.
 *
 * Google's script stays in the document after its component is gone and reports every later change
 * of address by itself. A person who walks from a public page into a private one is therefore
 * switched off with Google's own opt-out flag, then given a fresh document without the script.
 */
function Analytics() {
  const pathname = usePathname();
  const live = useSyncExternalStore(
    subscribe,
    () => window.location.origin === siteOrigin,
    () => false,
  );
  const tracked = live && isTrackedPath(pathname);
  const loaded = useRef(false);

  useEffect(() => {
    if (tracked) {
      loaded.current = true;
    } else if (loaded.current) {
      Reflect.set(window, `ga-disable-${analyticsMeasurementId}`, true);
      openWithoutReferrer();
    }
  }, [tracked]);

  return tracked ? <GoogleAnalytics gaId={analyticsMeasurementId} /> : null;
}

export { Analytics };
