"use client";

import { useEffect } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

/** Pages a person reads before agreeing: the consent text points to them. */
const readable: string[] = [siteRoutes.privacy, siteRoutes.terms];

/**
 * Sends a signed-in person who has not agreed to use the platform to the consent step, from any
 * page with the site header and on every move between them, and brings them back afterwards
 * (BEY-240). Rendered only while the account needs it; pages that need an account check it on the
 * server as well.
 */
function ConsentRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!readable.includes(pathname)) {
      // The address as the browser has it, with its locale and query, to come back to exactly.
      const returnTo = window.location.pathname + window.location.search;
      router.replace({ pathname: siteRoutes.consent, query: { returnTo } });
    }
  }, [pathname, router]);

  return null;
}

export { ConsentRedirect };
