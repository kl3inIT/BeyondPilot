import type { SaveSolution, Solution } from "@/lib/api/generated";

/** The steps of the editor, in order; the name is what the address carries. */
export const editorSteps = ["basics", "fit", "evidence", "review"] as const;

export type EditorStep = (typeof editorSteps)[number];

/** The limits the backend sets, repeated so a person meets them before a round trip. */
export const limits = {
  name: 120,
  summary: 600,
  longAnswer: 4000,
  traction: 600,
  bestCustomerProfile: 400,
  link: 300,
  choices: 5,
  languages: 10,
  builtWith: 10,
  builtWithName: 40,
} as const;

/** The deck the editor holds: the one the solution names, or one just uploaded and not saved yet. */
export type HeldDeck = {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  /** When the solution took it; null for a file the solution does not name yet. */
  attachedAt: string | null;
};

/** What the editor holds for a solution, as its controls hold it. */
export type SolutionDraft = {
  name: string;
  summary: string;
  problemsSolved: string;
  valueProposition: string;
  maturity: string;
  traction: string;
  builtWith: string[];
  industries: string[];
  focusAreas: string[];
  languages: string[];
  deployment: string[];
  bestCustomerProfile: string;
  website: string;
  demoUrl: string;
  deck: HeldDeck | null;
  listed: boolean;
};

/** What the editor holds for a solution as the backend last answered it. */
export function held(solution: Solution): SolutionDraft {
  return {
    name: solution.name,
    summary: solution.summary ?? "",
    problemsSolved: solution.problemsSolved ?? "",
    valueProposition: solution.valueProposition ?? "",
    maturity: solution.maturity ?? "",
    traction: solution.traction ?? "",
    builtWith: solution.builtWith,
    industries: solution.industries,
    focusAreas: solution.focusAreas,
    languages: solution.languages,
    deployment: solution.deployment,
    bestCustomerProfile: solution.bestCustomerProfile ?? "",
    website: solution.website ?? "",
    demoUrl: solution.demoUrl ?? "",
    deck: solution.deck ?? null,
    listed: solution.listed,
  };
}

const text = (value: string) => value.trim() || null;

const once = (values: string[]) => [...new Set(values)];

/**
 * The save the draft amounts to. It is written as the backend keeps it, trimmed and without
 * repeats, so that two drafts that would be saved the same compare equal.
 */
export function toRequest(draft: SolutionDraft, version: number): SaveSolution {
  return {
    name: draft.name.trim(),
    summary: text(draft.summary),
    problemsSolved: text(draft.problemsSolved),
    valueProposition: text(draft.valueProposition),
    maturity: (draft.maturity || null) as SaveSolution["maturity"],
    traction: text(draft.traction),
    builtWith: once(draft.builtWith.map((name) => name.trim()).filter(Boolean)),
    industries: once(draft.industries),
    focusAreas: once(draft.focusAreas),
    languages: once(draft.languages),
    deployment: once(draft.deployment),
    bestCustomerProfile: text(draft.bestCustomerProfile),
    website: text(draft.website),
    demoUrl: text(draft.demoUrl),
    deckFileId: draft.deck?.fileId ?? null,
    listed: draft.listed,
    version,
  };
}

/** What a draft would save, without the version: equal for two drafts the backend would keep alike. */
export function contentOf(draft: SolutionDraft): string {
  return JSON.stringify(toRequest(draft, 0));
}

/** The fields a review needs, each with the step that holds it, in the order of the editor. */
export const reviewFields = [
  { field: "name", step: "basics" },
  { field: "summary", step: "basics" },
  { field: "maturity", step: "basics" },
  { field: "industries", step: "fit" },
  { field: "focusAreas", step: "fit" },
] as const satisfies readonly { field: keyof SolutionDraft; step: EditorStep }[];

export type ReviewField = (typeof reviewFields)[number]["field"];

/** The fields a review needs and the draft does not hold yet. The backend checks the same. */
export function missingForReview(draft: SolutionDraft): ReviewField[] {
  return reviewFields
    .map((entry) => entry.field)
    .filter((field) => {
      const value = draft[field];
      return typeof value === "string" ? value.trim() === "" : value.length === 0;
    });
}

/** The links of a solution, which the backend takes only as full `http(s)` addresses. */
export const linkFields = ["demoUrl", "website"] as const;

export type LinkField = (typeof linkFields)[number];

/** The links that hold something the backend would refuse. An empty link is no link, which is fine. */
export function badLinks(draft: SolutionDraft): LinkField[] {
  return linkFields.filter((field) => {
    const value = draft[field].trim();
    return value !== "" && !/^https?:\/\/\S+$/.test(value);
  });
}

/** The step that holds each member of a save, so that a refused one can be shown where it is. */
export const fieldSteps: Record<string, EditorStep> = {
  name: "basics",
  summary: "basics",
  problemsSolved: "basics",
  valueProposition: "basics",
  maturity: "basics",
  traction: "basics",
  builtWith: "basics",
  industries: "fit",
  focusAreas: "fit",
  languages: "fit",
  deployment: "fit",
  bestCustomerProfile: "fit",
  deckFileId: "evidence",
  demoUrl: "evidence",
  website: "evidence",
  listed: "review",
};

/** The id of the control of a field, which a link from another step moves focus to. */
export function fieldId(field: string) {
  return `solution-${field}`;
}
