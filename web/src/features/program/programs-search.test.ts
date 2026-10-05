import { describe, expect, it } from "vitest";

import type { AdminProgramSummary } from "@/lib/api/generated";

import { narrowPrograms } from "./programs-search";

const program = (
  name: string,
  status: AdminProgramSummary["status"],
  phase: AdminProgramSummary["phase"],
): AdminProgramSummary => ({
  id: name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  name,
  type: "event",
  status,
  phase,
  updatedAt: "2026-10-05T03:00:00Z",
});

const programs = [
  program("Thử thách Bảo hiểm", "published", "open"),
  program("Agentic AI Build Week", "published", "done"),
  program("Monthly meetup", "draft", "upcoming"),
];

describe("narrowPrograms", () => {
  it("counts every state whatever the search", () => {
    const { counts, total } = narrowPrograms(programs, { state: "done", q: "nothing" });
    expect(counts).toEqual({ draft: 1, open: 1, upcoming: 0, running: 0, done: 1 });
    expect(total).toBe(3);
  });

  it("narrows by state, a draft being a draft whatever its dates", () => {
    expect(narrowPrograms(programs, { state: "draft", q: "" }).items.map((p) => p.name)).toEqual([
      "Monthly meetup",
    ]);
    expect(narrowPrograms(programs, { state: "upcoming", q: "" }).items).toEqual([]);
  });

  it("finds a name without its accents", () => {
    expect(
      narrowPrograms(programs, { state: null, q: "bao hiem" }).items.map((p) => p.name),
    ).toEqual(["Thử thách Bảo hiểm"]);
  });
});
