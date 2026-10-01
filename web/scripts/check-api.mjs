// Regenerates the API client from openapi.yml and fails when the committed output was stale.
// The regenerated files stay in place, so committing them fixes the failure.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createClient } from "@hey-api/openapi-ts";

const generated = "src/lib/api/generated";

function snapshot(directory, files = new Map()) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) snapshot(path, files);
    else
      files.set(
        relative(generated, path),
        createHash("sha256").update(readFileSync(path)).digest("hex"),
      );
  }
  return files;
}

const before = snapshot(generated);
await createClient();
const after = snapshot(generated);

const changed = [...new Set([...before.keys(), ...after.keys()])]
  .filter((path) => before.get(path) !== after.get(path))
  .sort();

if (changed.length > 0) {
  console.error(
    `The generated API client was stale; commit the regenerated files:\n- ${changed.join("\n- ")}`,
  );
  process.exit(1);
}
