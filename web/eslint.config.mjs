import { plugin as shadcn } from "@shadcn/lint";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
