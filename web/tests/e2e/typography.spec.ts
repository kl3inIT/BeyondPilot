import { expect, test, type Page } from "@playwright/test";

/**
 * The site's type is Lexend under Montserrat headings, wider than a typical sans and longer still in
 * Vietnamese (DESIGN.md › Keeping a line on one line). These widths are where the header and the footer
 * decide how many lines a link takes.
 */
const widths = [390, 768, 1024, 1280, 1440] as const;

type Measure = {
  overflow: number;
  controlPastEdge: string[];
  footerWrapped: string[];
  navLines: number[];
};

/** How wide the page is, which header controls leave the window, and how many lines each link takes. */
async function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const linesOf = (element: Element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
    };
    const visible = (element: Element) => element.getBoundingClientRect().width > 0;
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");
    const controls = [...(header?.querySelectorAll("a, button") ?? [])].filter(visible);
    const links = [...(footer?.querySelectorAll("a") ?? [])].filter(visible);
    const nav = [...(header?.querySelectorAll("nav a") ?? [])].filter(visible);
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controlPastEdge: controls
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .map((element) => element.textContent?.trim() ?? ""),
      footerWrapped: links
        .filter((element) => linesOf(element) > 1)
        .map((element) => element.textContent?.trim() ?? ""),
      navLines: nav.map(linesOf),
    };
  });
}

test.describe("the type of the header and the footer", () => {
  test.skip(({ isMobile }) => isMobile, "the widths are set by the test");

  for (const [path, language] of [
    ["/", "English"],
    ["/vi", "Vietnamese"],
  ] as const) {
    test(`${language} keeps its links in their place at every width`, async ({ page }) => {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect(page.getByRole("contentinfo")).toBeVisible();
        const found = await measure(page);
        const at = `at ${width}px`;

        expect(found.overflow, `the page is wider than the window ${at}`).toBeLessThanOrEqual(0);
        expect(found.controlPastEdge, `a header control leaves the window ${at}`).toEqual([]);
        expect(found.footerWrapped, `a footer link wraps ${at}`).toEqual([]);
        // A navigation link takes one line from 1280 up, and two at most below it.
        const most = Math.max(0, ...found.navLines);
        expect(most, `a navigation link takes too many lines ${at}`).toBeLessThanOrEqual(
          width >= 1280 ? 1 : 2,
        );
      }
    });
  }
});
