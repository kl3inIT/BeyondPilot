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

function attribute(html: string, pattern: RegExp) {
  return pattern.exec(html)?.[1]?.trim();
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

/**
 * The Markdown for Agents form of a rendered page (developers.cloudflare.com, "Markdown for
 * Agents"): a frontmatter block with the title, description and address, then the page's `<main>`
 * as Markdown. Without a `<main>` the whole body is converted.
 */
function pageToMarkdown(html: string, url: string): string {
  const title = attribute(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description = attribute(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const main = (
    /<main[^>]*>([\s\S]*)<\/main>/i.exec(html)?.[1] ??
    /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ??
    html
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

  return `${frontmatter}\n\n${converter(url).turndown(main).trim()}\n`;
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
