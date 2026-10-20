import { describe, expect, it } from "vitest";

import type {
  EvaluationAssessment,
  EvaluationCandidate,
  EvaluationRecord,
} from "@/lib/api/generated";

import {
  decisionCounts,
  decisionOf,
  differs,
  filtered,
  labelCounts,
  needsAttention,
  noFilter,
  sourceHref,
} from "./evaluation-view";

const application = (more: Partial<EvaluationRecord> = {}): EvaluationRecord => ({
  kind: "application",
  id: "app-1",
  status: "submitted",
  decision: "under_review",
  version: 1,
  changedAt: "2026-10-12T03:00:00Z",
  ...more,
});

const proposal = (more: Partial<EvaluationRecord> = {}): EvaluationRecord => ({
  kind: "proposal",
  id: "prop-1",
  status: "sent",
  useCaseId: "uc-1",
  version: 0,
  changedAt: "2026-10-12T03:00:00Z",
  ...more,
});

const assessment = (more: Partial<EvaluationAssessment> = {}): EvaluationAssessment => ({
  id: "a-1",
  tier: "potential_match",
  provisional: false,
  alignment: "direct",
  alignmentReason: "Automates renewals.",
  gate: { proposal: "passed", earlyStage: "not_needed", reason: "Specific." },
  criteria: [
    {
      key: "traction",
      tractionKind: "active_pilot",
      findings: [
        {
          label: "documented",
          summary: "Paid pilot",
          finding: "Reports a paid pilot.",
          gap: "",
          source: "application deck p.3",
          quote: "a paid pilot",
          quoteState: "exact",
          lowered: false,
        },
        {
          label: "claimed",
          summary: "Forty insurers",
          finding: "Claims forty insurers.",
          gap: "Quote not found in what was read.",
          source: "form: Traction",
          quote: "forty insurers",
          quoteState: "not_found",
          lowered: true,
        },
      ],
    },
  ],
  notes: {
    why: "Pilot underway.",
    concern: "Small team.",
    next: "Ask for results.",
    rationale: "Early but specific.",
    contradictions: [],
    questions: [],
  },
  coverage: [
    {
      record: "application",
      recordId: "app-1",
      label: "application deck",
      fileId: "file-1",
      file: "deck.pdf",
      pages: 12,
      read: 12,
      unread: [],
      cut: false,
    },
  ],
  instructionsInSources: false,
  modelName: "claude-sonnet-5-5",
  assessedAt: "2026-10-20T03:00:00Z",
  ...more,
});

const candidate = (more: Partial<EvaluationCandidate> = {}): EvaluationCandidate => ({
  organizationId: "org-1",
  organizationName: "Northwind Labs",
  solutionId: "sol-1",
  solutionName: "RenewIQ",
  state: "assessed",
  records: [application(), proposal()],
  assessment: assessment(),
  ...more,
});

describe("the decision across a candidate's records", () => {
  it("waits while one record is undecided, and a draft takes none", () => {
    expect(decisionOf(candidate())).toBe("to_decide");
    expect(
      decisionOf(
        candidate({
          records: [
            application({ decision: "shortlisted" }),
            proposal({ decision: "shortlisted" }),
            application({ id: "draft", status: "draft" }),
          ],
        }),
      ),
    ).toBe("shortlisted");
    expect(
      decisionOf(
        candidate({
          records: [application({ decision: "not_selected" }), proposal({ decision: "declined" })],
        }),
      ),
    ).toBe("not_selected");
    expect(
      decisionOf(
        candidate({
          records: [application({ decision: "shortlisted" }), proposal({ decision: "declined" })],
        }),
      ),
    ).toBe("mixed");
  });

  it("differs from the AI when a match is not selected or a Strong No is shortlisted", () => {
    const notSelected = [application({ decision: "not_selected" })];
    expect(differs(candidate({ records: notSelected }))).toBe(true);
    expect(
      differs(
        candidate({
          records: [application({ decision: "shortlisted" })],
          assessment: assessment({ tier: "strong_no" }),
        }),
      ),
    ).toBe(true);
    expect(differs(candidate())).toBe(false);
  });

  it("counts each decision for the filter", () => {
    expect(
      decisionCounts([
        candidate(),
        candidate({ records: [application({ decision: "shortlisted" })] }),
      ]),
    ).toEqual({ all: 2, to_decide: 1, shortlisted: 1, not_selected: 0 });
  });
});

describe("what needs a person's eye", () => {
  it("is a lowered quote, an unread page, an outdated assessment or a provisional tier", () => {
    expect(needsAttention(candidate())).toBe(true);
    const clean = assessment({
      criteria: [{ key: "team", findings: [assessment().criteria[0].findings[0]] }],
    });
    expect(needsAttention(candidate({ assessment: clean }))).toBe(false);
    expect(needsAttention(candidate({ assessment: clean, state: "outdated" }))).toBe(true);
    expect(needsAttention(candidate({ assessment: { ...clean, provisional: true } }))).toBe(true);
    expect(
      needsAttention(
        candidate({
          assessment: { ...clean, coverage: [{ ...clean.coverage[0], unread: [4] }] },
        }),
      ),
    ).toBe(true);
  });

  it("counts the labels of the findings", () => {
    expect(labelCounts(assessment())).toEqual({
      documented: 1,
      claimed: 1,
      not_disclosed: 0,
      contradictory: 0,
    });
  });
});

describe("the filter", () => {
  const all = [
    candidate(),
    candidate({
      organizationId: "org-2",
      organizationName: "Lotus AI",
      solutionName: "ClaimDesk",
      assessment: assessment({ tier: "strong_no" }),
      records: [application({ decision: "not_selected" })],
    }),
  ];

  it("keeps what the words, the tier and the decision name", () => {
    expect(filtered(all, { ...noFilter, search: "claimdesk" })).toHaveLength(1);
    expect(filtered(all, { ...noFilter, tier: "potential_match" })[0].organizationName).toBe(
      "Northwind Labs",
    );
    expect(filtered(all, { ...noFilter, decision: "not_selected" })).toHaveLength(1);
    expect(filtered(all, noFilter)).toHaveLength(2);
  });
});

describe("where a source opens", () => {
  it("opens a file at its page, a proposal on its page and the form on the application", () => {
    const one = candidate();
    expect(sourceHref("application deck p.3", one, "prog-1")).toBe(
      "/api/proposal/review/applications/app-1/files/file-1#page=3",
    );
    expect(sourceHref("proposal 1", one, "prog-1")).toBe("/admin/use-cases/uc-1/proposals/prop-1");
    expect(sourceHref("form: Traction", one, "prog-1")).toBe(
      "/admin/programs/prog-1/applications/app-1",
    );
    expect(sourceHref("solution profile", one, "prog-1")).toBeUndefined();
    expect(sourceHref("proposal 2", one, "prog-1")).toBeUndefined();
  });
});
