import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";
import { markdownPathHeader } from "@/lib/markdown-request";

const localeRouting = createMiddleware(routing);

/**
 * Locale routing, and Markdown for agents: a request whose `Accept` names `text/markdown` gets the
 * same page as Markdown from `app/markdown/route.ts`; browsers keep the HTML.
 */
export default function proxy(request: NextRequest) {
  if (request.method === "GET" && request.headers.get("accept")?.includes("text/markdown")) {
    const headers = new Headers(request.headers);
    headers.set(markdownPathHeader, request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.rewrite(new URL("/markdown", request.url), { request: { headers } });
  }
  return localeRouting(request);
}

export const config = {
  // Everything except whole Spring-owned segments, Next.js internals and files with an extension.
  matcher: "/((?!(?:api|login|logout|oauth2|ott)(?:/|$)|_next|_vercel|.*\\..*).*)",
};
