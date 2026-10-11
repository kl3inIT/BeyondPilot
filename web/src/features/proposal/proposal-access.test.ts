import { describe, expect, it } from "vitest";

import type { UseCaseProposalForm } from "@/lib/api/generated";

import { accessOfForm, accessOfRefusal, closedAt } from "./proposal-access";

const useCase = { id: "u", title: "T" };
const organization = { id: "o", name: "Org", approved: true };
const draft = {
  id: "p",
  status: "draft" as const,
  solutions: [],
  team: [],
  updatedAt: "2026-10-01T00:00:00Z",
  version: 1,
};

function form(parts: Partial<UseCaseProposalForm>): UseCaseProposalForm {
  return { members: [], useCase, ...parts };
}

describe("accessOfForm", () => {
  it("needs an organization, and an approved one", () => {
    expect(accessOfForm(form({ organization: null }))).toEqual({
      kind: "blocked",
      code: "PROPOSAL_NO_ORGANIZATION",
    });
    expect(accessOfForm(form({ organization: { ...organization, approved: false } }))).toEqual({
      kind: "blocked",
      code: "PROPOSAL_ORGANIZATION_NOT_APPROVED",
    });
  });

  it("opens a new proposal, a draft, or reports one sent", () => {
    expect(accessOfForm(form({ organization }))).toEqual({ kind: "open", draft: false });
    expect(accessOfForm(form({ organization, proposal: draft }))).toEqual({
      kind: "open",
      draft: true,
    });
    expect(accessOfForm(form({ organization, proposal: { ...draft, status: "sent" } }))).toEqual({
      kind: "sent",
    });
  });
});

describe("accessOfRefusal", () => {
  it("offers nothing for the own use case or a closed one", () => {
    expect(accessOfRefusal(403, "PROPOSAL_OWN_USE_CASE")).toEqual({ kind: "hidden" });
    expect(accessOfRefusal(409, "PROPOSAL_USE_CASE_CLOSED")).toEqual({ kind: "hidden" });
    expect(accessOfRefusal(404, undefined)).toEqual({ kind: "hidden" });
  });

  it("keeps the actions when the read failed for another reason", () => {
    expect(accessOfRefusal(500, undefined)).toEqual({ kind: "open", draft: false });
    expect(accessOfRefusal(undefined, undefined)).toEqual({ kind: "open", draft: false });
  });
});

describe("closedAt", () => {
  const now = Date.parse("2026-10-11T00:00:00Z");

  it("is closed from the closing instant on", () => {
    expect(closedAt("2026-10-11T00:00:00Z", now)).toBe(true);
    expect(closedAt("2026-10-10T00:00:00Z", now)).toBe(true);
  });

  it("is open before it and without one", () => {
    expect(closedAt("2026-10-12T00:00:00Z", now)).toBe(false);
    expect(closedAt(null, now)).toBe(false);
  });
});
