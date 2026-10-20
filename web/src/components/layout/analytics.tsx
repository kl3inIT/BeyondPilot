"use client";

import { GoogleAnalytics, sendGAEvent } from "@next/third-parties/google";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { CookieConsent } from "@/components/layout/cookie-consent";
import { usePublicSite } from "@/components/layout/use-public-site";
import { usePathname } from "@/i18n/navigation";
import { applyTarget, isTrackedPath } from "@/lib/analytics";
import { readConsent, subscribeConsent } from "@/lib/analytics-consent";
import { analyticsMeasurementId } from "@/lib/site";

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
 * Reports a click on a link to an apply or propose page as `apply_click`. Those pages are behind
 * sign-in and never measured, so the click on the public page is the only trace of the intent.
 */
function reportApplyClick(event: MouseEvent) {
  const link = event.target instanceof Element ? event.target.closest("a") : null;
  const target = link?.origin === window.location.origin ? applyTarget(link.pathname) : null;

  if (target) {
    sendGAEvent("event", "apply_click", target);
  }
}

/**
 * Google Analytics 4 for the public pages of the public address only. Staging and a local run
 * serve the same build, so the browser decides by its host when it hydrates; on any other host,
 * and on a page `isTrackedPath` refuses, nothing is loaded or sent. On a page it may measure, the
 * visitor is asked first, and Google's script is loaded only after they accept.
 *
 * Google's script stays in the document after its component is gone and reports every later change
 * of address by itself. A person who walks from a public page into a private one is therefore
 * switched off with Google's own opt-out flag, then given a fresh document without the script.
 */
function Analytics({ nonce }: { nonce?: string }) {
  const pathname = usePathname();
  const live = usePublicSite();
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => null);
  const measurable = live && isTrackedPath(pathname);
  const tracked = measurable && consent === "granted";
  const loaded = useRef(false);

  // A layout effect, so the flag is set in the task that changes the address, before Google's
  // script, which reads the flag about a second later, can report the private page.
  useLayoutEffect(() => {
    if (tracked) {
      loaded.current = true;
    } else if (loaded.current) {
      Reflect.set(window, `ga-disable-${analyticsMeasurementId}`, true);
      openWithoutReferrer();
    }
  }, [tracked]);

  useEffect(() => {
    if (!tracked) {
      return;
    }
    document.addEventListener("click", reportApplyClick, true);
    return () => document.removeEventListener("click", reportApplyClick, true);
  }, [tracked]);

  if (tracked) {
    return <GoogleAnalytics gaId={analyticsMeasurementId} nonce={nonce} />;
  }

  return measurable && consent === null ? <CookieConsent /> : null;
}

export { Analytics };
