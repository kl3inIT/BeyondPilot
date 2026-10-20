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
<script type="application/ld+json">{"@type":"FAQPage","name":"\\u003cb>Q"}</script>
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

  it("ends with the page's structured data as fenced JSON", () => {
    expect(markdown.endsWith('```json\n{\n  "@type": "FAQPage",\n  "name": "<b>Q"\n}\n```\n')).toBe(
      true,
    );
  });

  it("counts about four characters to a token", () => {
    expect(estimateTokens("x".repeat(9))).toBe(3);
  });
});

// A page with a loading.tsx streams: the skeleton goes out first, the list later at the end of the body.
describe("pageToMarkdown of a streamed page", () => {
  const streamed = `<!DOCTYPE html><html><head><title>Use cases</title></head><body>
<main id="content"><h1>Use cases</h1><!--$?--><template id="B:0"></template><div><p>Loading</p><div class="skeleton"></div></div><!--/$--></main>
<footer>© 2026 BeyondPilot</footer>
<script>$RS=function(a,b){}</script><div hidden id="S:0"><ul><template id="P:1"></template><li><a href="/use-cases/b">Second</a></li></ul><!--$--><p>2 use cases</p><!--/$--></div>
<div hidden id="S:1"><li><a href="/use-cases/a">First</a></li></div><script>$RS("S:1","P:1")</script>
<script>$RC=function(a,b){};$RC("B:0","S:0")</script></body></html>`;
  const markdown = pageToMarkdown(streamed, "https://beyondpilot.ai/use-cases");

  it("reads the streamed content in place of the skeleton", () => {
    expect(markdown).toContain("# Use cases");
    expect(markdown).toContain("[First](https://beyondpilot.ai/use-cases/a)");
    expect(markdown).toContain("[Second](https://beyondpilot.ai/use-cases/b)");
    expect(markdown).toContain("2 use cases");
    expect(markdown).not.toContain("Loading");
    expect(markdown.indexOf("First")).toBeLessThan(markdown.indexOf("Second"));
  });
});
