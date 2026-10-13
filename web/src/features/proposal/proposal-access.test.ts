import { describe, expect, it } from "vitest";

import type { UseCaseProposalForm } from "@/lib/api/generated";

import { accessOfForm, accessOfRefusal, closedAt, editStateOf } from "./proposal-access";

const useCase = { id: "u", title: "T" };
const organization = {
  id: "o",
  name: "Org",
  approved: true,
  owner: true,
  type: "company" as const,
};
const draft = {
  id: "p",
  status: "draft" as const,
  solutions: [],
  updatedAt: "2026-10-01T00:00:00Z",
  version: 1,
};

function form(parts: Partial<UseCaseProposalForm>): UseCaseProposalForm {
  return { useCase, ...parts };
}

describe("accessOfForm", () => {
  it("lets a person without an organization, or with one waiting for review, start", () => {
    expect(accessOfForm(form({ organization: null }))).toEqual({ kind: "open", draft: false });
    expect(accessOfForm(form({ organization: { ...organization, approved: false } }))).toEqual({
      kind: "open",
      draft: false,
    });
  });

  it("opens a new proposal, a draft, or reports one sent", () => {
    expect(accessOfForm(form({ organization }))).toEqual({ kind: "open", draft: false });
    expect(accessOfForm(form({ organization, proposal: draft }))).toEqual({
      kind: "open",
      draft: true,
    });
    const sent = { ...draft, status: "sent" as const };
    expect(accessOfForm(form({ organization, proposal: sent }))).toEqual({
      kind: "sent",
      proposal: sent,
    });
  });
});

describe("accessOfRefusal", () => {
  it("offers nothing for the own use case or a closed one", () => {
    expect(accessOfRefusal(403, "PROPOSAL_OWN_USE_CASE")).toEqual({ kind: "own" });
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

describe("editStateOf", () => {
  const now = Date.parse("2026-10-11T00:00:00Z");
  const open = { closesAt: "2026-12-01T00:00:00Z", proposalEditDays: 7 };

  it("is editable while the server gives an end", () => {
    expect(editStateOf({ editableUntil: "2026-10-15T00:00:00Z" }, open, now)).toEqual({
      kind: "editable",
      until: "2026-10-15T00:00:00Z",
    });
  });

  it("says why editing is over", () => {
    expect(editStateOf({ editableUntil: null }, { ...open, proposalEditDays: 0 }, now)).toEqual({
      kind: "closed",
      reason: "disabled",
    });
    expect(editStateOf({}, { ...open, closesAt: "2026-10-01T00:00:00Z" }, now)).toEqual({
      kind: "closed",
      reason: "useCaseClosed",
    });
    expect(editStateOf({ editableUntil: null }, open, now)).toEqual({
      kind: "closed",
      reason: "windowPassed",
    });
  });
});
