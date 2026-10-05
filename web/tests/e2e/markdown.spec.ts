import { expect, test } from "@playwright/test";

// Agents that ask for Markdown get the page as Markdown; browsers keep the HTML.
test.describe("Markdown for agents", () => {
  test("a request accepting text/markdown gets the page's main content", async ({ request }) => {
    const response = await request.get("/vi", { headers: { accept: "text/markdown" } });

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
    expect(response.headers()["vary"]).toContain("Accept");
    expect(Number(response.headers()["x-markdown-tokens"])).toBeGreaterThan(0);
    const markdown = await response.text();
    expect(markdown).toMatch(/^---\ntitle: /);
    expect(markdown).toContain("# Pilot AI tiếp theo bắt đầu từ đây.");
    expect(markdown).not.toContain("<");
  });

  test("a browser still gets HTML", async ({ request }) => {
    const response = await request.get("/", { headers: { accept: "text/html" } });

    expect(response.headers()["content-type"]).toContain("text/html");
  });

  test("an unknown page is a Markdown 404", async ({ request }) => {
    const response = await request.get("/khong-ton-tai", { headers: { accept: "text/markdown" } });

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
  });
});

// What a language model reads before it reads the pages.
test.describe("llms.txt and structured data", () => {
  test("llms.txt describes the site, its pages, its program and its answers", async ({
    request,
  }) => {
    const response = await request.get("/llms.txt");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
    const text = await response.text();
    expect(text).toMatch(/^# BeyondPilot\n\n> /);
    expect(text).toContain("AI for Insurance Challenge × Tasco");
    expect(text).toContain("- **Who can apply to a campaign?**");
  });

  test("the home page describes the site and every answer as JSON-LD", async ({ page }) => {
    await page.goto("/");

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => scripts.map((script) => JSON.parse(script.textContent ?? "")));
    const faq = blocks.find((block) => block["@type"] === "FAQPage");
    expect(faq.mainEntity).toHaveLength(6);
    const graph = blocks.find((block) => block["@graph"])["@graph"];
    expect(graph.map((node: { "@type": string }) => node["@type"])).toEqual([
      "Organization",
      "WebSite",
    ]);
  });
});
