import { describe, expect, it } from "vitest";

import type { MyUseCaseSummary } from "@/lib/api/generated";

import { sortMyUseCases } from "./my-use-cases-search";

const posted = (
  id: string,
  title: string | null,
  updatedAt: string,
  status: MyUseCaseSummary["status"] = "approved",
) => ({ id, title, updatedAt, status }) as MyUseCaseSummary;

const useCases = [
  posted("a", "Claims triage", "2026-10-01T00:00:00Z"),
  posted("b", "Broker portal", "2026-10-09T00:00:00Z", "draft"),
  posted("c", null, "2026-10-05T00:00:00Z"),
];
const proposals = new Map([
  ["a", 3],
  ["c", 7],
]);

const ids = (list: { items: MyUseCaseSummary[] }) => list.items.map((item) => item.id);

describe("sortMyUseCases", () => {
  it("lists the latest changed first when the URL names no order, or one it does not know", () => {
    const list = sortMyUseCases(useCases, proposals, { sort: "" });
    expect(list.defaultSort).toBe("-updated");
    expect(ids(list)).toEqual(["b", "c", "a"]);
    expect(ids(sortMyUseCases(useCases, proposals, { sort: "budget" }))).toEqual(["b", "c", "a"]);
  });

  it("sorts by title, an untitled draft first", () => {
    expect(ids(sortMyUseCases(useCases, proposals, { sort: "useCase" }))).toEqual(["c", "b", "a"]);
  });

  it("sorts by proposals, an unpublished use case last either way", () => {
    expect(ids(sortMyUseCases(useCases, proposals, { sort: "-proposals" }))).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(ids(sortMyUseCases(useCases, proposals, { sort: "proposals" }))).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("keeps the server's order by proposals when the counts could not be read", () => {
    expect(ids(sortMyUseCases(useCases, null, { sort: "-proposals" }))).toEqual(["a", "b", "c"]);
  });
});
