import { describe, expect, it } from "vitest";

import { estimateTokens, pageToMarkdown } from "./markdown";

const page = `<!DOCTYPE html><html><head>
<title>BeyondPilot</title>
<meta name="description" content="Enterprise AI challenges, &quot;solved&quot; together."/>
</head><body>
<header><a href="/">BeyondPilot</a><nav><a href="/programs">Programs</a></nav></header>
<main id="content">
<h1>Your next AI pilot starts here.</h1>
<a href="/apply"><span>Live</span><span class="md:hidden">Tasco</span><span class="hidden md:inline">Tasco challenge</span></a>
<h3 class="md:hidden">Open now</h3><h3 class="hidden md:flex">Open now · Tasco</h3>
<h3><button type="button">Who can apply?</button></h3><div hidden="until-found">Anyone with a solution.</div>
<div aria-hidden="true"><p>Floating card</p></div>
<p>Read the <a href="/vi/programs?x=1">programs</a>.</p>
<form role="search"><input name="q"/><button type="submit">Search</button></form>
<img alt="Builders at Build Week" src="/_next/image?url=%2Fprograms%2Fdemo-day.jpg&amp;w=640&amp;q=75"/>
<img alt="" src="/landing/glow.png"/>
<script>self.__next_f.push([1])</script>
</main>
<footer>© 2026 BeyondPilot</footer>
</body></html>`;

// What an agent reads instead of the page: the main content and nothing a person only sees around it.
describe("pageToMarkdown", () => {
  const markdown = pageToMarkdown(page, "https://beyondpilot.ai/");

  it("starts with the page's title, description and address", () => {
    expect(
      markdown.startsWith(
        '---\ntitle: "BeyondPilot"\ndescription: "Enterprise AI challenges, \\"solved\\" together."\nurl: "https://beyondpilot.ai/"\n---\n\n# Your next AI pilot starts here.',
      ),
    ).toBe(true);
  });

  it("keeps the wide-screen text, set apart, and every answer of a closed accordion", () => {
    expect(markdown).toContain("[Live Tasco challenge](https://beyondpilot.ai/apply)");
    expect(markdown).toContain("### Who can apply?\n\nAnyone with a solution.");
  });

  it("keeps the main content with absolute links and original images", () => {
    expect(markdown).toContain("Read the [programs](https://beyondpilot.ai/vi/programs?x=1).");
    expect(markdown).toContain(
      "![Builders at Build Week](https://beyondpilot.ai/programs/demo-day.jpg)",
    );
  });

  it("leaves out the header, footer, navigation, search form, decoration and scripts", () => {
    for (const absent of [
      "Programs](",
      "© 2026",
      "Search",
      "Floating card",
      "__next_f",
      "glow.png",
    ]) {
      expect(markdown).not.toContain(absent);
    }
  });

  it("counts about four characters to a token", () => {
    expect(estimateTokens("x".repeat(9))).toBe(3);
  });
});
