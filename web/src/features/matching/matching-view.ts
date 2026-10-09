import type { MatchingCandidate, MatchingFinding, MatchingRequirement } from "@/lib/api/generated";

/** How many words of a statement stand in for a need that has no label. */
const NAME_WORDS = 4;

/** The groups a judged candidate is shown in, strongest first. */
export const groups = ["direct", "industry", "technology"] as const;

export type Group = (typeof groups)[number];

export type NeedStatus = MatchingFinding["status"];

/** One capability the use case asks for, as the coverage line, the chips and the dots name it. */
export type Need = {
  position: number;
  name: string;
  required: boolean;
};

/** What the candidates together show of one need. */
export type NeedCoverage = Need & {
  /** `met` when a recommended candidate meets it, `partly` when one only comes near, else `not_shown`. */
  best: NeedStatus;
  /** How many candidates meet it or come near. */
  count: number;
};

/** Where a quote stands in a solution's material, read from the label the backend gives a source. */
export type Source =
  | { kind: "profile" }
  | { kind: "customerCase"; number: number }
  | { kind: "deck"; page: number }
  | { kind: "website" };

/** The name a requirement is shown by: its label, or the first words of its statement. */
export function requirementName(requirement: Pick<MatchingRequirement, "label" | "statement">) {
  const label = requirement.label.trim();
  if (label) {
    return label;
  }
  const words = requirement.statement.trim().split(/\s+/);
  return words.length > NAME_WORDS ? `${words.slice(0, NAME_WORDS).join(" ")}…` : words.join(" ");
}

/** The needs of a use case: its capabilities only. A constraint is read in a candidate's panel. */
export function needsOf(requirements: MatchingRequirement[]): Need[] {
  return requirements
    .filter((requirement) => requirement.kind === "capability")
    .map((requirement) => ({
      position: requirement.position,
      name: requirementName(requirement),
      required: requirement.necessity === "required",
    }));
}

/** The conditions of delivery, which are confirmed with the vendor and decide no group. */
export function constraintsOf(requirements: MatchingRequirement[]): MatchingRequirement[] {
  return requirements.filter((requirement) => requirement.kind === "constraint");
}

/** What a candidate's material shows of one requirement, when it was judged on it. */
export function findingOf(
  candidate: Pick<MatchingCandidate, "findings">,
  position: number,
): MatchingFinding | undefined {
  return candidate.findings.find((finding) => finding.requirement === position);
}

/** Whether a candidate meets a requirement; one without a finding does not show it. */
export function statusOf(
  candidate: Pick<MatchingCandidate, "findings">,
  position: number,
): NeedStatus {
  return findingOf(candidate, position)?.status ?? "not_shown";
}

/**
 * Whether a candidate is on the screen at all: one a run judged and put in no group is not, unless a
 * person decided on it, since a later run must not hide what someone shortlisted or removed. One that
 * waits to be judged is shown.
 */
export function isShown(candidate: Pick<MatchingCandidate, "judged" | "bucket" | "decision">) {
  return !candidate.judged || candidate.bucket !== "none" || candidate.decision !== "none";
}

/** The candidates of each tab. A removed candidate is in the Removed tab alone. */
export function tabsOf(candidates: MatchingCandidate[]) {
  const shown = candidates.filter(isShown);
  return {
    all: shown.filter((candidate) => candidate.decision !== "removed"),
    shortlist: shown.filter((candidate) => candidate.decision === "shortlisted"),
    removed: shown.filter((candidate) => candidate.decision === "removed"),
  };
}

/** The candidates a run recommends: judged, in a group, and not removed. */
export function recommendedOf(candidates: MatchingCandidate[]) {
  return tabsOf(candidates).all.filter(
    (candidate) => candidate.judged && candidate.bucket !== "none",
  );
}

/** For each need, the best any recommended candidate shows and how many show something of it. */
export function coverageOf(needs: Need[], candidates: MatchingCandidate[]): NeedCoverage[] {
  const recommended = recommendedOf(candidates);
  return needs.map((need) => {
    const statuses = recommended.map((candidate) => statusOf(candidate, need.position));
    return {
      ...need,
      best: statuses.includes("met") ? "met" : statuses.includes("partly") ? "partly" : "not_shown",
      count: statuses.filter((status) => status !== "not_shown").length,
    };
  });
}

/** The candidates that meet a need or come near it; every candidate when no need is chosen. */
export function withNeed(candidates: MatchingCandidate[], position: number | null) {
  return position === null
    ? candidates
    : candidates.filter((candidate) => statusOf(candidate, position) !== "not_shown");
}

/**
 * Candidates by group, in the order the run found them, those that wait to be judged, and those a
 * person keeps although the last run put them in no group.
 */
export function grouped(candidates: MatchingCandidate[]) {
  const judged = candidates.filter((candidate) => candidate.judged);
  return {
    direct: judged.filter((candidate) => candidate.bucket === "direct"),
    industry: judged.filter((candidate) => candidate.bucket === "industry"),
    technology: judged.filter((candidate) => candidate.bucket === "technology"),
    waiting: candidates.filter((candidate) => !candidate.judged),
    kept: judged.filter((candidate) => candidate.bucket === "none"),
  };
}

/**
 * The quote a candidate's row shows: of a need it meets before one it comes near, a required need
 * before an optional one; without any, what shows its industry, its technology or its fit to the problem.
 */
export function bestQuote(
  candidate: Pick<MatchingCandidate, "findings" | "industry" | "technology" | "problem">,
  needs: Need[],
): Pick<MatchingFinding, "quote" | "source"> | undefined {
  const ranked = needs
    .map((need) => ({ need, finding: findingOf(candidate, need.position) }))
    .filter(
      (entry): entry is { need: Need; finding: MatchingFinding } =>
        entry.finding !== undefined &&
        entry.finding.status !== "not_shown" &&
        entry.finding.quote.trim() !== "",
    )
    .sort(
      (a, b) =>
        Number(b.finding.status === "met") - Number(a.finding.status === "met") ||
        Number(b.need.required) - Number(a.need.required) ||
        a.need.position - b.need.position,
    );
  const found =
    ranked[0]?.finding ??
    [candidate.industry, candidate.technology, candidate.problem].find(
      (finding) => finding && finding.status !== "not_shown" && finding.quote.trim() !== "",
    );
  return found ? { quote: found.quote, source: found.source } : undefined;
}

/** Reads the backend's label of a source; a label this screen does not know gives nothing. */
export function sourceOf(label: string): Source | undefined {
  const text = label.trim().toLowerCase();
  if (text === "profile") {
    return { kind: "profile" };
  }
  const customerCase = /^customer case (\d+)$/.exec(text);
  if (customerCase) {
    return { kind: "customerCase", number: Number(customerCase[1]) };
  }
  const deck = /^deck p\.\s?(\d+)$/.exec(text);
  if (deck) {
    return { kind: "deck", page: Number(deck[1]) };
  }
  return /^website( \d+)?$/.test(text) ? { kind: "website" } : undefined;
}
