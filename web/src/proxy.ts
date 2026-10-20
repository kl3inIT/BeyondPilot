import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";
import { canonicalUrl } from "@/lib/canonical-host";
import { contentSecurityPolicy, newNonce, nonceHeader } from "@/lib/content-security-policy";
import { markdownPathHeader } from "@/lib/markdown-request";

const localeRouting = createMiddleware(routing);

/**
 * The one address of the public site, locale routing, and Markdown for agents: a request whose `Accept` names `text/markdown` gets the
 * same page as Markdown from `app/markdown/route.ts`; browsers keep the HTML. A page asked for on the
 * `www` name is answered with a permanent redirect to the same page of the public address.
 *
 * The browser's language never chooses the language of the site. next-intl has one switch for the
 * browser's language and for the choice a person made earlier, so the switch stays on and every
 * request reaches it asking for the default language. What is left to decide is the address, then
 * the person's own choice, then English.
 */
export default function proxy(request: NextRequest) {
  const canonical = canonicalUrl(
    request.headers.get("host"),
    request.nextUrl.pathname + request.nextUrl.search,
  );
  if (canonical) {
    return NextResponse.redirect(canonical, 308);
  }
  if (request.method === "GET" && request.headers.get("accept")?.includes("text/markdown")) {
    const headers = new Headers(request.headers);
    headers.set(markdownPathHeader, request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.rewrite(new URL("/markdown", request.url), { request: { headers } });
  }
  request.headers.set("accept-language", routing.defaultLocale);
  // Next.js reads the nonce from the request's policy and puts it on its scripts; the page reads it
  // from x-nonce for the scripts it adds itself. The browser gets the same policy.
  const nonce = newNonce();
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  request.headers.set(nonceHeader, nonce);
  request.headers.set("content-security-policy", policy);
  const response = localeRouting(request);
  response.headers.set("content-security-policy", policy);
  return response;
}

export const config = {
  // Everything except whole Spring-owned segments, Next.js internals and files with an extension.
  matcher: "/((?!(?:api|login|logout|oauth2|ott)(?:/|$)|_next|_vercel|.*\\..*).*)",
};
