import { describe, expect, it } from "vitest";

import type { UseCaseProposalForm } from "@/lib/api/generated";

import {
  accessOfForm,
  accessOfRefusal,
  closedAt,
  editStateOf,
  mayChange,
  outcomeOf,
} from "./proposal-access";

const useCase = { id: "u", title: "T" };
const organization = {
  id: "o",
  name: "Org",
  active: true,
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
    expect(accessOfForm(form({ organization: { ...organization, active: false } }))).toEqual({
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

  it("says when a proposal that was taken back was, and lets it be sent again", () => {
    const taken = { ...draft, withdrawnAt: "2026-10-12T03:00:00Z" };
    expect(accessOfForm(form({ organization, proposal: taken }))).toEqual({
      kind: "open",
      draft: true,
      withdrawnAt: "2026-10-12T03:00:00Z",
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

describe("outcomeOf", () => {
  it("is what the organization told the sender about a sent proposal", () => {
    expect(outcomeOf({ status: "sent", outcome: "shortlisted" })).toBe("shortlisted");
    expect(outcomeOf({ status: "sent", outcome: "declined" })).toBe("declined");
  });

  it("is nothing until it was told, and for a draft", () => {
    expect(outcomeOf({ status: "sent" })).toBeNull();
    expect(outcomeOf({ status: "draft", outcome: "declined" })).toBeNull();
  });
});

describe("mayChange", () => {
  it("keeps a proposal open to change unless it was not selected", () => {
    expect(mayChange(null)).toBe(true);
    expect(mayChange("shortlisted")).toBe(true);
    expect(mayChange("declined")).toBe(false);
  });
});
