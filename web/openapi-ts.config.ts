import { defineConfig } from "@hey-api/openapi-ts";

// The client, the SDK and the types of the backend's contract. The TanStack Query plugin arrives
// with the first screen that reads through it.
export default defineConfig({
  input: "../openapi.yml",
  output: "src/lib/api/generated",
  plugins: [
    // Every SDK call rejects with ApiError on a failed request (src/lib/api/client.ts).
    { name: "@hey-api/client-next", runtimeConfigPath: "./src/lib/api/client", throwOnError: true },
    "@hey-api/typescript",
    "@hey-api/sdk",
  ],
});
