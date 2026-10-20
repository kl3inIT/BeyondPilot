import TurndownService from "turndown";

/** What a page says to an agent: its main content, without the site's chrome or decoration. */
const chrome = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "HEADER", "FOOTER", "NAV", "FORM"]);

/** Text written twice, short for phones and long for wider screens; agents read the wide one. */
const phoneOnly = /(?:^|\s)(?:sm|md|lg|xl|2xl|desktop):hidden(?:\s|$)/;

function leftOut(node: TurndownService.Node) {
  if (chrome.has(node.nodeName.toUpperCase())) {
    return true;
  }
  if (node.nodeType !== 1) {
    return false;
  }
  const element = node as HTMLElement;
  return (
    element.getAttribute("aria-hidden") === "true" ||
    phoneOnly.test(element.getAttribute("class") ?? "")
  );
}

/** `/_next/image?url=%2Fx.jpg&w=640` is the optimizer's address for `/x.jpg`; agents get the file. */
function imageSource(src: string, base: string) {
  const url = new URL(src, base);
  const original = url.pathname === "/_next/image" ? url.searchParams.get("url") : null;
  return original ? new URL(original, base).href : url.href;
}

function converter(base: string) {
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });
  // Added rules outrank the built-in heading and paragraph rules, which `remove` does not.
  service.addRule("leftOut", { filter: leftOut, replacement: () => "" });
  service.addRule("absoluteLink", {
    filter: (node) => node.nodeName === "A" && Boolean(node.getAttribute("href")),
    replacement: (content, node) => {
      const text = content.replace(/\s+/g, " ").trim();
      const href = new URL((node as HTMLElement).getAttribute("href")!, base).href;
      return text ? `[${text}](${href})` : "";
    },
  });
  service.addRule("image", {
    filter: "img",
    replacement: (_, node) => {
      const image = node as HTMLImageElement;
      const alt = image.getAttribute("alt")?.trim();
      const src = image.getAttribute("src");
      // An image without alternative text is decoration and says nothing to an agent.
      return alt && src ? `![${alt}](${imageSource(src, base)})` : "";
    },
  });
  return service;
}

/** Where the element opened just before `from` closes: the index past its closing tag, counting nested ones. */
function closingIndex(html: string, from: number, open: RegExp, close: string) {
  const tags = new RegExp(`${open.source}|${close.replace(/[$/]/g, "\\$&")}`, "g");
  tags.lastIndex = from;
  let depth = 1;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[0] === close ? -1 : 1;
    if (depth === 0) {
      return match.index + match[0].length;
    }
  }
  return -1;
}

/**
 * The page as a browser shows it once streaming ends. A page with a `loading.tsx` sends its
 * fallback in place, then each finished part as `<div hidden id="S:…">` at the end of the body with
 * a script that moves it in: `$RC("B:…","S:…")` swaps a Suspense fallback for its content and
 * `$RS("S:…","P:…")` fills a placeholder. Read as sent, `<main>` holds only the skeleton.
 */
function revealStreamed(html: string): string {
  const segments = new Map<string, string>();
  let page = html;
  for (let opening = /<div hidden id="(S:[0-9a-z]+)">/.exec(page); opening;) {
    const start = opening.index + opening[0].length;
    const end = closingIndex(page, start, /<div\b/, "</div>");
    if (end < 0) {
      break;
    }
    segments.set(opening[1], page.slice(start, end - "</div>".length));
    page = page.slice(0, opening.index) + page.slice(end);
    opening = /<div hidden id="(S:[0-9a-z]+)">/.exec(page);
  }

  let pending = [...html.matchAll(/\$R([CS])\("([A-Z]:[0-9a-z]+)","([A-Z]:[0-9a-z]+)"\)/g)];
  while (pending.length > 0) {
    const waiting: typeof pending = [];
    for (const call of pending) {
      const [, kind, first, second] = call;
      const [segment, target] = kind === "C" ? [second, first] : [first, second];
      const marker = `<template id="${target}"></template>`;
      const at = page.indexOf(marker);
      const content = segments.get(segment!);
      if (at < 0 || content === undefined) {
        waiting.push(call);
        continue;
      }
      // A boundary's fallback runs from its template to the comment that closes the boundary.
      const end =
        kind === "C" ? closingIndex(page, at, /<!--\$[?!]?-->/, "<!--/$-->") : at + marker.length;
      page = page.slice(0, at) + content + (end < 0 ? "" : page.slice(end));
    }
    if (waiting.length === pending.length) {
      break;
    }
    pending = waiting;
  }
  return page;
}

function attribute(html: string, pattern: RegExp) {
  return pattern.exec(html)?.[1]?.trim();
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

/**
 * The Markdown for Agents form of a rendered page (developers.cloudflare.com, "Markdown for
 * Agents"): a frontmatter block with the title, description and address, then the page's `<main>`
 * as Markdown, and last the page's JSON-LD in fenced blocks, as the spec keeps it. Without a
 * `<main>` the whole body is converted.
 */
function pageToMarkdown(html: string, url: string): string {
  const title = attribute(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description = attribute(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const shown = revealStreamed(html);
  const main = (
    /<main[^>]*>([\s\S]*)<\/main>/i.exec(shown)?.[1] ??
    /<body[^>]*>([\s\S]*)<\/body>/i.exec(shown)?.[1] ??
    shown
  )
    // Inline pieces set apart only by CSS gaps would run together as text.
    .replace(/<\/(span|time|strong|em|small|b)>(?=<)/gi, "</$1> ");

  const frontmatter = [
    "---",
    ...(title ? [`title: ${yamlString(decode(title))}`] : []),
    ...(description ? [`description: ${yamlString(decode(description))}`] : []),
    `url: ${yamlString(url)}`,
    "---",
  ].join("\n");

  const structuredData = [
    ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
  ].map(([, json]) => `\`\`\`json\n${JSON.stringify(JSON.parse(json), null, 2)}\n\`\`\``);

  return [frontmatter, converter(url).turndown(main).trim(), ...structuredData].join("\n\n") + "\n";
}

/** The few entities React writes into attributes and titles. */
function decode(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

/** A rough count, four characters to a token, for the `x-markdown-tokens` header. */
function estimateTokens(markdown: string) {
  return Math.ceil(markdown.length / 4);
}

export { estimateTokens, pageToMarkdown };
