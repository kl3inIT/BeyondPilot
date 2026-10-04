import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit tests sit next to what they test. They run in Node; a test that needs a DOM names its
// environment when the first one is written.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
