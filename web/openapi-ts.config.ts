import { defineConfig } from "@hey-api/openapi-ts";

// The contract has no operations yet, so only its types are generated. The fetch client, SDK and
// TanStack Query plugins arrive with the first endpoint the web calls.
export default defineConfig({
  input: "../openapi.yml",
  output: "src/lib/api/generated",
  plugins: ["@hey-api/typescript"],
});
