import type {
  EvaluationAssessment,
  EvaluationCandidate,
  EvaluationCoverage,
  EvaluationFinding,
  EvaluationRecord,
} from "@/lib/api/generated";
import {
  adminProgramApplicationsRoute,
  adminProgramDraftRoute,
  adminUseCaseProposalRoute,
} from "@/lib/site";

// What the evaluation board makes of the candidates the API answers (BEY-234): their tier's tone,
// the decision across their records, what needs a person's eye, and where a quoted source opens.

type Tier = EvaluationAssessment["tier"];
type Label = EvaluationFinding["label"];

export const tiers = [
  "strong_match",
  "potential_match",
  "to_consider",
  "strong_no",
] as const satisfies readonly Tier[];

/** The badge of each tier, as the approved prototype draws it. */
export const tierVariant = {
  strong_match: "success",
  potential_match: "info",
  to_consider: "warning",
  strong_no: "destructive",
} as const satisfies Record<Tier, string>;

/** The pill of each evidence label. */
export const labelTone = {
  documented: "info",
  claimed: "warning",
  not_disclosed: "neutral",
  contradictory: "destructive",
} as const satisfies Record<Label, string>;

/**
 * What people decided across a candidate's records that are read: `to_decide` while one is undecided,
 * `shortlisted` or `not_selected` when all agree, `mixed` otherwise. A draft takes no decision.
 */
type Decision = "to_decide" | "shortlisted" | "not_selected" | "mixed";

export const decisions = ["to_decide", "shortlisted", "not_selected"] as const;

/** The records a person decides on: a submitted application and the proposals sent. */
export function decidable(candidate: EvaluationCandidate): EvaluationRecord[] {
  return candidate.records.filter((record) => record.status !== "draft");
}

/** One record's decision on the board's scale. */
export function recordDecision(record: EvaluationRecord): Exclude<Decision, "mixed"> {
  if (record.decision === "shortlisted") {
    return "shortlisted";
  }
  if (record.decision === "not_selected" || record.decision === "declined") {
    return "not_selected";
  }
  return "to_decide";
}

export function decisionOf(candidate: EvaluationCandidate): Decision {
  const each = decidable(candidate).map(recordDecision);
  if (each.length === 0 || each.includes("to_decide")) {
    return "to_decide";
  }
  return each.every((one) => one === each[0]) ? each[0] : "mixed";
}

/** Whether people decided against what the AI suggested: a match not selected, a Strong No shortlisted. */
export function differs(candidate: EvaluationCandidate): boolean {
  const tier = candidate.assessment?.tier;
  const decided = decisionOf(candidate);
  return (
    ((tier === "strong_match" || tier === "potential_match") && decided === "not_selected") ||
    (tier === "strong_no" && decided === "shortlisted")
  );
}

/** The words the backend gives a file it could not open, in the place of the file it repeats. */
export const NOT_OPENED = "could not be opened as a PDF";

/**
 * Files with pages that held no text, even read from their picture, or that the limits left out, and
 * files that could not be opened. A file held twice is read once and is not among them.
 */
function unreadOf(coverage: EvaluationCoverage[]): EvaluationCoverage[] {
  return coverage.filter(
    (read) =>
      read.unread.length > 0 ||
      read.cut ||
      read.note === NOT_OPENED ||
      (read.fileId && read.read === 0 && !read.note),
  );
}

/** Findings whose label code lowered, because their quote is not in what was read. */
function loweredOf(assessment: EvaluationAssessment): EvaluationFinding[] {
  return assessment.criteria.flatMap((criterion) =>
    criterion.findings.filter((finding) => finding.lowered),
  );
}

/**
 * Why a candidate needs a person's eye before its tier is trusted: it changed since, its tier waits
 * on a demonstration, a quote was not found, a page was not read, or a source spoke to the AI.
 */
export function attentionOf(candidate: EvaluationCandidate) {
  const assessment = candidate.assessment;
  return {
    outdated: candidate.state === "outdated",
    provisional: assessment?.provisional ?? false,
    lowered: assessment ? loweredOf(assessment).length : 0,
    unread: assessment ? unreadOf(assessment.coverage).length : 0,
    instructions: assessment?.instructionsInSources ?? false,
  };
}

export function needsAttention(candidate: EvaluationCandidate): boolean {
  const attention = attentionOf(candidate);
  return (
    attention.outdated ||
    attention.provisional ||
    attention.lowered > 0 ||
    attention.unread > 0 ||
    attention.instructions
  );
}

/** How many findings of an assessment carry each label. */
export function labelCounts(assessment: EvaluationAssessment): Record<Label, number> {
  const counts = { documented: 0, claimed: 0, not_disclosed: 0, contradictory: 0 };
  for (const criterion of assessment.criteria) {
    for (const finding of criterion.findings) {
      counts[finding.label] += 1;
    }
  }
  return counts;
}

export type Filter = {
  search: string;
  tier: Tier | "all";
  decision: (typeof decisions)[number] | "all";
  attention: boolean;
};

export const noFilter: Filter = { search: "", tier: "all", decision: "all", attention: false };

/** The candidates a filter keeps, in the order the API gave them. */
export function filtered(candidates: EvaluationCandidate[], filter: Filter): EvaluationCandidate[] {
  const words = filter.search.trim().toLocaleLowerCase();
  return candidates.filter((candidate) => {
    if (
      words &&
      !`${candidate.organizationName} ${candidate.solutionName}`.toLocaleLowerCase().includes(words)
    ) {
      return false;
    }
    if (filter.tier !== "all" && candidate.assessment?.tier !== filter.tier) {
      return false;
    }
    const decided = decisionOf(candidate);
    if (filter.decision !== "all" && decided !== filter.decision) {
      return false;
    }
    return !filter.attention || needsAttention(candidate) || differs(candidate);
  });
}

/** How many candidates hold each decision, for the counts beside the filter. */
export function decisionCounts(candidates: EvaluationCandidate[]) {
  const counts = { all: candidates.length, to_decide: 0, shortlisted: 0, not_selected: 0 };
  for (const candidate of candidates) {
    const decided = decisionOf(candidate);
    if (decided !== "mixed") {
      counts[decided] += 1;
    }
  }
  return counts;
}

/** The key a candidate is known by on the board and in its address. */
export function keyOf(candidate: Pick<EvaluationCandidate, "organizationId" | "solutionId">) {
  return `${candidate.organizationId}/${candidate.solutionId}`;
}

/** Where a record opens in the admin. */
export function recordHref(record: EvaluationRecord, programId: string): string {
  if (record.kind === "application") {
    return record.status === "draft"
      ? adminProgramDraftRoute(programId, record.id)
      : `${adminProgramApplicationsRoute(programId)}/${record.id}`;
  }
  return record.useCaseId ? adminUseCaseProposalRoute(record.useCaseId, record.id) : "#";
}

/** A file's address for an operator, as the application's and the proposal's pages open it. */
function fileAddress(read: EvaluationCoverage): string | undefined {
  if (!read.fileId) {
    return undefined;
  }
  return read.record === "application"
    ? `/api/proposal/review/applications/${read.recordId}/files/${read.fileId}`
    : `/api/proposal/use-case-proposals/${read.recordId}/file`;
}

const PAGE = /^(.+) p\.(\d{1,4})$/;
const PROPOSAL = /^proposal (\d{1,3})(?: team)?$/;

/**
 * Where a finding's source opens: a page of a file at that page, a proposal on its own page, the
 * form's answers on the application's page. A source the board cannot place has none.
 */
export function sourceHref(
  source: string,
  candidate: EvaluationCandidate,
  programId: string,
): string | undefined {
  const coverage = candidate.assessment?.coverage ?? [];
  const page = PAGE.exec(source.trim());
  if (page) {
    const read = coverage.find((one) => one.fileId && one.label === page[1]);
    const address = read && fileAddress(read);
    return address ? `${address}#page=${page[2]}` : undefined;
  }
  const proposal = PROPOSAL.exec(source.trim());
  if (proposal) {
    const sent = candidate.records.filter((record) => record.kind === "proposal");
    const record = sent[Number(proposal[1]) - 1];
    return record ? recordHref(record, programId) : undefined;
  }
  if (source.startsWith("form:")) {
    const application = candidate.records.find(
      (record) => record.kind === "application" && record.status === "submitted",
    );
    return application ? recordHref(application, programId) : undefined;
  }
  return undefined;
}
