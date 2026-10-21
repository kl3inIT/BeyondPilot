import { useSyncExternalStore } from "react";

import { publicSiteHost, siteOrigin } from "@/lib/site";

const subscribe = () => () => {};

/**
 * Whether the page is served from the public address. Staging and a local run serve the same
 * build, so the browser decides by its host when it hydrates; the server always answers no.
 */
function usePublicSite(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin === siteOrigin,
    () => false,
  );
}

/**
 * The host the page is served from, for an address an operator reads or copies: staging writes
 * its own, the public site beyondpilot.ai. The server, which serves every deployment the same
 * build, answers the public host until the browser hydrates.
 */
function useSiteHost(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.host,
    () => publicSiteHost,
  );
}

export { usePublicSite, useSiteHost };
