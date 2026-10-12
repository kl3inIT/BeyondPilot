import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const src = join(__dirname, "..");

/** Every source file under src, except this test. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("globals.css", () => {
  it("keeps out of the stylesheet only primitives that nothing imports", () => {
    const css = readFileSync(join(__dirname, "globals.css"), "utf8");
    const excluded = [...css.matchAll(/@source not "\.\.\/components\/ui\/([\w-]+)\.tsx"/g)].map(
      (match) => match[1],
    );
    const code = sourceFiles(src).map((file) => readFileSync(file, "utf8"));

    expect(excluded.length).toBeGreaterThan(0);
    const imported = excluded.filter((name) =>
      code.some((text) => new RegExp(`["'](@/components/ui|\.)/${name}["']`).test(text)),
    );
    // An imported primitive needs its classes: take it off the @source not list in globals.css.
    expect(imported).toEqual([]);
  });
});
