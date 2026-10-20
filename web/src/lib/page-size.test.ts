import { describe, expect, it } from "vitest";

import { gridPageSize, pageSize } from "./page-size";

describe("page sizes in the address", () => {
  it("lets a directory of cards hold only the sizes it offers", () => {
    expect(gridPageSize.parse("24")).toBe(24);
    expect(gridPageSize.parse("13")).toBeNull();
    expect(gridPageSize.parse("10")).toBeNull();
  });

  it("keeps any size the API takes for a list in rows", () => {
    expect(pageSize.parse("13")).toBe(13);
    expect(pageSize.parse("101")).toBeNull();
  });
});
