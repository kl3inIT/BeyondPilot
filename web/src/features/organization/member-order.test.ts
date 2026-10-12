import { describe, expect, it } from "vitest";

import { membersInOrder } from "./member-order";

const members = [
  { accountId: "c", role: "member", joinedAt: "2026-03-01T00:00:00Z" },
  { accountId: "a", role: "owner", joinedAt: "2026-05-01T00:00:00Z" },
  { accountId: "b", role: "member", joinedAt: "2026-01-01T00:00:00Z" },
  { accountId: "d", role: "owner", joinedAt: "2026-02-01T00:00:00Z" },
];

const order = (sort: string) => membersInOrder(members, sort).map((member) => member.accountId);

describe("The members of an organization in order", () => {
  it("stand owners first, then as they joined, until an order is chosen", () => {
    expect(order("")).toEqual(["d", "a", "b", "c"]);
    expect(order("role")).toEqual(["d", "a", "b", "c"]);
    expect(order("status")).toEqual(["d", "a", "b", "c"]);
  });

  it("reverse the role alone, and keep the order of joining inside it", () => {
    expect(order("-role")).toEqual(["b", "c", "d", "a"]);
  });

  it("stand as they joined, earliest or latest first", () => {
    expect(order("joined")).toEqual(["b", "d", "c", "a"]);
    expect(order("-joined")).toEqual(["a", "c", "d", "b"]);
  });
});
