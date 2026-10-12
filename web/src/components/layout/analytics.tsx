"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { useSyncExternalStore } from "react";

import { analyticsMeasurementId, siteOrigin } from "@/lib/site";

const subscribe = () => () => {};

/**
 * Google Analytics 4 for the public address only. Staging and a local run serve the same build, so
 * the browser decides by its host when it hydrates; on any other host nothing is loaded or sent.
 */
function Analytics() {
  const live = useSyncExternalStore(
    subscribe,
    () => window.location.origin === siteOrigin,
    () => false,
  );

  return live ? <GoogleAnalytics gaId={analyticsMeasurementId} /> : null;
}

export { Analytics };
