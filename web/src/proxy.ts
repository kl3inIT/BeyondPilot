import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Everything except whole Spring-owned segments, Next.js internals and files with an extension.
  matcher: "/((?!(?:api|login|logout|oauth2|ott)(?:/|$)|_next|_vercel|.*\\..*).*)",
};
