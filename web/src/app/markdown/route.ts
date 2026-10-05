import type { NextRequest } from "next/server";

import { estimateTokens, pageToMarkdown } from "@/lib/markdown";
import { localPath } from "@/lib/return-to";

/**
 * The Markdown form of a page, reached only through `src/proxy.ts` when a request asks for
 * `text/markdown`. The page is rendered by this same server without the caller's cookies, so an
 * agent always reads the public page and never anyone's account.
 */
export async function GET(request: NextRequest) {
  const path = localPath(request.nextUrl.searchParams.get("path"));
  if (!path) {
    return new Response("Not found\n", { status: 404 });
  }

  const self = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const page = await fetch(new URL(path, self), {
    headers: { accept: "text/html" },
    cache: "no-store",
  });
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const scheme = request.headers.get("x-forwarded-proto") ?? "https";
  const markdown = pageToMarkdown(await page.text(), new URL(path, `${scheme}://${host}`).href);

  return new Response(markdown, {
    status: page.status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "x-markdown-tokens": String(estimateTokens(markdown)),
    },
  });
}
