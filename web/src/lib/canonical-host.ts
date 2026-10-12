import { siteOrigin } from "@/lib/site";

/**
 * Where a request to the `www` name of the public site belongs: the same page on the public
 * address. The site has one address, so a visitor is asked about cookies once, is measured once
 * and keeps one session. Any other host, staging and a local run among them, gets `null`.
 */
function canonicalUrl(host: string | null, pathAndQuery: string): string | null {
  return host === `www.${new URL(siteOrigin).host}` ? `${siteOrigin}${pathAndQuery}` : null;
}

export { canonicalUrl };
