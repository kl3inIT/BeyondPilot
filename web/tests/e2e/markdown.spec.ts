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
