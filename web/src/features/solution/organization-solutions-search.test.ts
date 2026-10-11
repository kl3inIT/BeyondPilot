import { describe, expect, it } from "vitest";

import type { SolutionSummary } from "@/lib/api/generated";

import { sortOrganizationSolutions } from "./organization-solutions-search";

const solution = (
  name: string,
  updatedAt: string,
  status: SolutionSummary["status"] = "approved",
  submittedAt: string | null = null,
) => ({ id: name, name, updatedAt, status, submittedAt }) as SolutionSummary;

// As the server reads them: the newest created first.
const solutions = [
  solution("Claims Copilot", "2026-10-02T00:00:00Z"),
  solution("Agent Desk", "2026-10-09T00:00:00Z", "in_review", "2026-10-01T00:00:00Z"),
  solution("Broker Bot", "2026-10-05T00:00:00Z"),
];

const names = (list: { items: SolutionSummary[] }) => list.items.map((item) => item.name);

describe("sortOrganizationSolutions", () => {
  it("keeps the server's order when the URL names none, or a key it does not know", () => {
    const list = sortOrganizationSolutions(solutions, { sort: "" });
    expect(list.defaultSort).toBe("-created");
    expect(list.sortKeys).not.toContain("created");
    expect(names(list)).toEqual(["Claims Copilot", "Agent Desk", "Broker Bot"]);
    expect(names(sortOrganizationSolutions(solutions, { sort: "created" }))).toEqual(names(list));
  });

  it("sorts by name", () => {
    expect(names(sortOrganizationSolutions(solutions, { sort: "solution" }))).toEqual([
      "Agent Desk",
      "Broker Bot",
      "Claims Copilot",
    ]);
  });

  it("sorts by the day shown: when it was sent while it waits for review", () => {
    expect(names(sortOrganizationSolutions(solutions, { sort: "-updated" }))).toEqual([
      "Broker Bot",
      "Claims Copilot",
      "Agent Desk",
    ]);
  });
});
