/**
 * The page an agent asked for as Markdown, set by `src/proxy.ts` on the request it rewrites to
 * `app/markdown/route.ts`. A rewrite carries no query of its own, so the path travels here, and the
 * proxy overwrites whatever value a caller sent.
 */
export const markdownPathHeader = "x-beyondpilot-markdown-path";
