import { describe, expect, it } from "vitest";

import { fieldOfPointer } from "./problem-fields";

describe("fieldOfPointer", () => {
  it("names a member, a nested member and a member of a list item as a form does", () => {
    expect(fieldOfPointer("#/name")).toBe("name");
    expect(fieldOfPointer("#/applications/closesAt")).toBe("applications.closesAt");
    expect(fieldOfPointer("#/keyDates/0/title")).toBe("keyDates[0].title");
  });

  it("reads the escapes of a JSON Pointer", () => {
    expect(fieldOfPointer("#/a~1b/c~0d")).toBe("a/b.c~d");
  });
});
