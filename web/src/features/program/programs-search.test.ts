import { describe, expect, it } from "vitest";

import type { AdminProgramSummary } from "@/lib/api/generated";

import { narrowPrograms, type ProgramsSearch } from "./programs-search";

const program = (
  name: string,
  status: AdminProgramSummary["status"],
  phase: AdminProgramSummary["phase"],
  startsOn: string | null = null,
): AdminProgramSummary => ({
  id: name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  name,
  type: "event",
  status,
  phase,
  startsOn,
  updatedAt: "2026-10-05T03:00:00Z",
});

const search = (values: Partial<ProgramsSearch> = {}): ProgramsSearch => ({
  state: null,
  q: "",
  sort: "",
  ...values,
});

const programs = [
  program("Thử thách Bảo hiểm", "published", "open", "2026-10-01"),
  program("Agentic AI Build Week", "published", "done", "2026-08-01"),
  program("Monthly meetup", "draft", "upcoming"),
];

const names = (list: { items: AdminProgramSummary[] }) => list.items.map((p) => p.name);

describe("narrowPrograms", () => {
  it("counts every state whatever the search", () => {
    const { counts, total } = narrowPrograms(programs, search({ state: "done", q: "nothing" }));
    expect(counts).toEqual({ draft: 1, open: 1, upcoming: 0, running: 0, done: 1 });
    expect(total).toBe(3);
  });

  it("narrows by state, a draft being a draft whatever its dates", () => {
    expect(names(narrowPrograms(programs, search({ state: "draft" })))).toEqual(["Monthly meetup"]);
    expect(narrowPrograms(programs, search({ state: "upcoming" })).items).toEqual([]);
  });

  it("finds a name without its accents", () => {
    expect(names(narrowPrograms(programs, search({ q: "bao hiem" })))).toEqual([
      "Thử thách Bảo hiểm",
    ]);
  });

  it("lists what takes applications first, then what comes, then what is over", () => {
    const list = narrowPrograms(programs, search());
    expect(list.defaultSort).toBe("status");
    expect(names(list)).toEqual(["Thử thách Bảo hiểm", "Monthly meetup", "Agentic AI Build Week"]);
  });

  it("sorts by the column the URL names, a program without days last either way", () => {
    expect(names(narrowPrograms(programs, search({ sort: "program" })))).toEqual([
      "Agentic AI Build Week",
      "Monthly meetup",
      "Thử thách Bảo hiểm",
    ]);
    expect(names(narrowPrograms(programs, search({ sort: "-runs" })))).toEqual([
      "Thử thách Bảo hiểm",
      "Agentic AI Build Week",
      "Monthly meetup",
    ]);
    expect(names(narrowPrograms(programs, search({ sort: "runs" })))).toEqual([
      "Agentic AI Build Week",
      "Thử thách Bảo hiểm",
      "Monthly meetup",
    ]);
  });

  it("keeps its own order for a key it does not know", () => {
    expect(names(narrowPrograms(programs, search({ sort: "budget" })))).toEqual(
      names(narrowPrograms(programs, search())),
    );
  });
});
