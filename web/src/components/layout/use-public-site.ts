import { useSyncExternalStore } from "react";

import { siteOrigin } from "@/lib/site";

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

export { usePublicSite };
