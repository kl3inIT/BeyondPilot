import type { NextRequest } from "next/server";

import { estimateTokens, pageToMarkdown } from "@/lib/markdown";
import { markdownPathHeader } from "@/lib/markdown-request";
import { localPath } from "@/lib/return-to";
import { siteOrigin } from "@/lib/site";

/**
 * The Markdown form of a page, reached only through `src/proxy.ts` when a request asks for
 * `text/markdown`. The page is rendered by this same server without the caller's cookies, so an
 * agent always reads the public page and never anyone's account. Addresses in the answer use the
 * public origin, never the request's Host, and a redirect is handed back rather than followed.
 */
export async function GET(request: NextRequest) {
  const path = localPath(request.headers.get(markdownPathHeader));
  if (!path) {
    return new Response("Not found\n", { status: 404 });
  }

  const self = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const page = await fetch(new URL(path, self), {
    headers: { accept: "text/html" },
    cache: "no-store",
    redirect: "manual",
  });

  const location = page.headers.get("location");
  if (location) {
    const target = new URL(location, self);
    return new Response(null, {
      status: page.status,
      headers: {
        Location:
          target.origin === self
            ? new URL(target.pathname + target.search, siteOrigin).href
            : target.href,
        Vary: "Accept",
      },
    });
  }

  const markdown = pageToMarkdown(await page.text(), new URL(path, siteOrigin).href);
  return new Response(markdown, {
    status: page.status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "x-markdown-tokens": String(estimateTokens(markdown)),
    },
  });
}
