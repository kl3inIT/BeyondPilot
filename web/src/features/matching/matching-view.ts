import type {
  MatchingCandidate,
  MatchingFinding,
  MatchingRequirement,
  MatchingRun,
} from "@/lib/api/generated";

/** How many words of a statement stand in for a need that has no label. */
const NAME_WORDS = 4;

/** The groups a judged candidate is shown in, strongest first. */
export const groups = ["direct", "industry", "technology"] as const;

export type Group = (typeof groups)[number];

export type NeedStatus = MatchingFinding["status"];

/** The parts of the list: the three groups, what waits to be read, and what a person keeps. */
export type Section = Group | "waiting" | "kept";

/** What a run goes through, in order; the last is its end. */
export const runStages = ["brief", "search", "reading", "done"] as const;

export type RunStage = (typeof runStages)[number];

/** What just happened to the solutions, for the line under the stages of a run. */
export type Activity =
  { kind: "added"; name: string; group: Group } | { kind: "several"; read: number; added: number };

/** How many rows a folding group shows when it is first opened. */
export const FOLDED_ROWS = 5;

/** One capability the use case asks for: a short name for a chip, and its statement in full. */
export type Need = {
  position: number;
  name: string;
  statement: string;
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
      statement: requirement.statement.trim(),
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
    matches: shown.filter((candidate) => candidate.decision !== "removed"),
    shortlist: shown.filter((candidate) => candidate.decision === "shortlisted"),
    removed: shown.filter((candidate) => candidate.decision === "removed"),
  };
}

/** The candidates a run recommends: judged, in a group, and not removed. */
export function recommendedOf(candidates: MatchingCandidate[]) {
  return tabsOf(candidates).matches.filter(
    (candidate) => candidate.judged && candidate.bucket !== "none",
  );
}

/**
 * The numbers of the sentence above the list of a use case that asks for one thing: how many solutions
 * a run recommends, and how many of them are in the first group.
 */
export function matchesOf(candidates: MatchingCandidate[]) {
  const recommended = recommendedOf(candidates);
  return {
    matches: recommended.length,
    strong: recommended.filter((candidate) => candidate.bucket === "direct").length,
  };
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
 * How a group stands in the list. The first two groups and the small ones show every row. The last
 * group folds: closed it shows its header alone, opened its first rows, and all of them on request.
 */
export function groupView(
  section: Section,
  total: number,
  state: { folds: boolean; opened: boolean; all: boolean },
) {
  const folds = state.folds && section === "technology";
  const open = !folds || state.opened;
  const shown = !open ? 0 : folds && !state.all ? Math.min(total, FOLDED_ROWS) : total;
  return { folds, open, shown, more: open ? total - shown : 0 };
}

/** The statuses, strongest first, as a row counts them. */
export const statuses = ["met", "partly", "not_shown"] as const satisfies NeedStatus[];

/**
 * What a row says under a solution's name: over the capabilities the use case asks for, how many the
 * solution meets, meets in part and shows no evidence for. A solution not read yet says nothing.
 */
export function statusCounts(
  candidate: Pick<MatchingCandidate, "judged" | "findings">,
  needs: Need[],
): Record<NeedStatus, number> | undefined {
  if (!candidate.judged || needs.length === 0) {
    return undefined;
  }
  const counts: Record<NeedStatus, number> = { met: 0, partly: 0, not_shown: 0 };
  for (const need of needs) {
    counts[statusOf(candidate, need.position)] += 1;
  }
  return counts;
}

/**
 * The stage a run is at. A run that is not at work is at none, and one that ended is at its end. A
 * running run says its stage; one that does not is reading solutions once it has found some.
 */
export function stageOf(
  run: Pick<MatchingRun, "state" | "stage" | "total"> | null | undefined,
): RunStage | undefined {
  if (run?.state === "done") {
    return "done";
  }
  if (run?.state !== "running") {
    return undefined;
  }
  return run.stage ?? (run.total > 0 ? "reading" : "brief");
}

/** Where a stage stands for a run that is at `at`: behind it, the one at work, or still ahead. */
export function stageState(stage: RunStage, at: RunStage): "passed" | "current" | "ahead" {
  const place = runStages.indexOf(stage);
  const reached = runStages.indexOf(at);
  // The end is not a stage at work: a run that reached it has passed every stage.
  return place < reached || at === "done" ? "passed" : place === reached ? "current" : "ahead";
}

/**
 * What became of the solutions between two reads of a use case. A solution is read when the earlier
 * read held it unread and the later holds it read; it is added when it then stands in a group of the
 * list. One read that fits no group leaves the list and is not spoken of. `arrived` names the rows that
 * entered a group, those a run read again and moved to another group included.
 */
export function changesBetween(
  before: MatchingCandidate[],
  after: MatchingCandidate[],
): { activity?: Activity; arrived: string[] } {
  const earlier = new Map(before.map((candidate) => [candidate.id, candidate]));
  const inGroup = (candidate: MatchingCandidate) =>
    candidate.judged && candidate.bucket !== "none" && candidate.decision !== "removed";
  const read = after.filter((candidate) => {
    const was = earlier.get(candidate.id);
    return was !== undefined && !was.judged && candidate.judged;
  });
  const added = read.filter(inGroup);
  const moved = after.filter((candidate) => {
    const was = earlier.get(candidate.id);
    return was?.judged === true && inGroup(candidate) && was.bucket !== candidate.bucket;
  });
  const arrived = [...added, ...moved].map((candidate) => candidate.id);
  if (read.length > 1) {
    return { activity: { kind: "several", read: read.length, added: added.length }, arrived };
  }
  const [one] = added;
  return one && one.bucket !== "none"
    ? { activity: { kind: "added", name: one.solutionName, group: one.bucket }, arrived }
    : { arrived };
}

/** Which of a solution's deck and website the AI could not read. */
export function unreadOf(
  candidate: Pick<MatchingCandidate, "unread">,
): "deck" | "website" | "both" | undefined {
  const deck = candidate.unread.includes("deck");
  const website = candidate.unread.includes("website");
  return deck && website ? "both" : deck ? "deck" : website ? "website" : undefined;
}

/**
 * The host of a web page as a reader names it, without "www."; nothing for an address that is not a
 * web address, which this screen never makes a link of.
 */
export function hostOf(address: string | null | undefined): string | undefined {
  if (!address || !URL.canParse(address)) {
    return undefined;
  }
  const url = new URL(address);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
    return undefined;
  }
  return url.hostname.replace(/^www\./, "");
}

/** How a reader opens the place a quote comes from. */
export type Opening =
  | { how: "deck"; page: number }
  | { how: "website"; href: string; host: string }
  | { how: "profile" };

/**
 * How the place a finding's quote comes from opens, or nothing when it stays plain text. A page of the
 * deck opens inside the app, for a solution whose deck anyone may read at its public address; a page of
 * the website opens at the address kept for it; the profile and a customer case open the solution's
 * page. A quote the check found in another source than the one named is not opened as a deck page: the
 * page named does not hold it.
 */
export function openingOf(
  finding: Pick<MatchingFinding, "source" | "sourceUrl" | "quoteState">,
  listed: boolean,
): Opening | undefined {
  const source = sourceOf(finding.source);
  if (source?.kind === "website") {
    const host = hostOf(finding.sourceUrl);
    return host && finding.sourceUrl
      ? { how: "website", href: finding.sourceUrl, host }
      : undefined;
  }
  if (!source || !listed) {
    return undefined;
  }
  if (source.kind === "deck") {
    return finding.quoteState === "other_source" ? undefined : { how: "deck", page: source.page };
  }
  return { how: "profile" };
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
