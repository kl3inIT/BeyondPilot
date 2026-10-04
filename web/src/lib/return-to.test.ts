import { describe, expect, it } from "vitest";

import { localPath } from "./return-to";

// The path a person returns to after signing in arrives in a link anyone can write. A value a
// browser would read as another site's address must never be followed.
describe("localPath", () => {
  it.each(["/admin", "/vi/programs/tasco?step=2", "/programs/a-b_c/apply#team"])(
    "keeps the path of this site %j",
    (value) => {
      expect(localPath(value)).toBe(value);
    },
  );

  it.each([
    ["nothing", undefined],
    ["an empty value", ""],
    ["another site", "https://evil.example/admin"],
    ["a protocol-relative address", "//evil.example/admin"],
    ["a backslash a browser reads as a slash", "/\\evil.example"],
    ["a backslash further in", "/admin\\..\\x"],
    ["a tab a browser drops", "/\t/evil.example"],
    ["a line break a browser drops", "/\n/evil.example"],
    ["a space", "/admin page"],
    ["a path without its leading slash", "admin"],
    ["a script address", "javascript:alert(1)"],
    ["a value longer than 2000 characters", `/${"a".repeat(2000)}`],
  ])("drops %s", (_name, value) => {
    expect(localPath(value)).toBeUndefined();
  });
});
