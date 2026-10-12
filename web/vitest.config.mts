import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit tests sit next to what they test, and the name of the file says where it runs
// (docs/conventions.md › Quality gates): `*.test.ts` is a function in Node, `*.test.tsx` is a
// component drawn in jsdom with Testing Library. Both projects take the alias from here, and only
// the component project pays for the DOM and its setup file.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    projects: [
      { test: { name: "node", include: ["src/**/*.test.ts"], environment: "node" } },
      {
        test: {
          name: "dom",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["src/test/setup.ts"],
          // next-intl imports `next/navigation` without its extension, which Node refuses and
          // Vite resolves: the package is transformed here instead of loaded as it is.
          server: { deps: { inline: ["next-intl"] } },
        },
      },
    ],
  },
});
