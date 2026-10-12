import { plugin as shadcn } from "@shadcn/lint";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jestDom from "eslint-plugin-jest-dom";
import testingLibrary from "eslint-plugin-testing-library";

// Dates are written one way (docs/conventions.md › Internationalization): next-intl's own formatter
// would write an English date the American way, so only src/i18n may take it.
const appFormatters = [
  {
    name: "next-intl",
    importNames: ["useFormatter", "createFormatter"],
    message: "Use useFormatter from @/i18n/format.",
  },
  {
    name: "next-intl/server",
    importNames: ["getFormatter"],
    message: "Use getFormatter from @/i18n/format-server.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Every @shadcn/lint design-system rule (docs/conventions.md › Frontend). Registry primitives
    // under components/ui style their own internals and hold the variant tables, so they are exempt,
    // and so are the elements taken from assistant-ui's registry under components/assistant-ui.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**", "src/components/assistant-ui/**"],
    plugins: { shadcn },
    rules: {
      "shadcn/no-raw-colors": "error",
      "shadcn/no-inline-styles": "error",
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-unknown-classes": "error",
      "shadcn/require-static-classes": "error",
      // Appearance comes from a component's variants and sizes; className may only place it.
      "shadcn/no-restyle": ["error", { allow: ["layout"] }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/i18n/**"],
    rules: { "no-restricted-imports": ["error", { paths: appFormatters }] },
  },
  {
    // Component tests (docs/guidelines/testing.md › Component tests) ask the screen as a person
    // does and assert with the DOM matchers. They draw through @/test/render, which gives a
    // component the application's messages, URL state and router.
    files: ["src/**/*.test.tsx", "src/test/**"],
    extends: [testingLibrary.configs["flat/react"], jestDom.configs["flat/recommended"]],
  },
  {
    files: ["src/**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...appFormatters,
            {
              name: "@testing-library/react",
              importNames: ["render"],
              message: "Use render from @/test/render.",
            },
          ],
        },
      ],
    },
  },
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    // Generated from openapi.yml by `pnpm generate:api`.
    "src/lib/api/generated/**",
  ]),
]);

export default eslintConfig;
