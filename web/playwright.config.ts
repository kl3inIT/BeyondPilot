import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    // Entrance animations fade text in; accessibility checks read the settled page.
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // The production build. Deployments run the standalone server inside Linux containers; on Windows
    // that server cannot follow the symlinks pnpm leaves in .next/standalone, so tests use next start.
    // `next` is called directly (pnpm test:e2e puts node_modules/.bin on PATH): with `pnpm start`, a
    // process outlived Playwright's kill of the server's process group on Linux and held its output
    // open, so the run hung after the last test.
    command: `next build && next start --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
