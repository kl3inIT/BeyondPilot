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
  channels: 120,
  link: 300,
  choices: 5,
  languages: 10,
  builtWith: 10,
  builtWithName: 40,
  images: 4,
} as const;

/** The deck the editor holds: the one the solution names, or one just uploaded and not saved yet. */
export type HeldDeck = {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  /** When the solution took it; null for a file the solution does not name yet. */
  attachedAt: string | null;
};

/** An image the editor holds: one the solution names, or one just uploaded and not saved yet. */
export type HeldImage = {
  fileId: string;
  fileName: string;
  sizeBytes: number;
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
  channels: string;
  bestCustomerProfile: string;
  website: string;
  demoUrl: string;
  deck: HeldDeck | null;
  logo: HeldImage | null;
  cover: HeldImage | null;
  /** The images under the cover, in the order they are shown. */
  images: HeldImage[];
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
    channels: solution.channels ?? "",
    bestCustomerProfile: solution.bestCustomerProfile ?? "",
    website: solution.website ?? "",
    demoUrl: solution.demoUrl ?? "",
    deck: solution.deck ?? null,
    logo: solution.logo ?? null,
    cover: solution.cover ?? null,
    images: solution.images,
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
    channels: text(draft.channels),
    bestCustomerProfile: text(draft.bestCustomerProfile),
    website: text(draft.website),
    demoUrl: text(draft.demoUrl),
    deckFileId: draft.deck?.fileId ?? null,
    logoFileId: draft.logo?.fileId ?? null,
    coverFileId: draft.cover?.fileId ?? null,
    imageFileIds: draft.images.map((image) => image.fileId),
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
  { field: "logo", step: "evidence" },
  { field: "cover", step: "evidence" },
] as const satisfies readonly { field: keyof SolutionDraft; step: EditorStep }[];

export type ReviewField = (typeof reviewFields)[number]["field"];

/** The fields a review needs and the draft does not hold yet. The backend checks the same. */
export function missingForReview(draft: SolutionDraft): ReviewField[] {
  return reviewFields
    .map((entry) => entry.field)
    .filter((field) => {
      const value = draft[field];
      if (value === null) {
        return true;
      }
      if (typeof value === "string") {
        return value.trim() === "";
      }
      return Array.isArray(value) && value.length === 0;
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
  channels: "fit",
  bestCustomerProfile: "fit",
  deckFileId: "evidence",
  logoFileId: "evidence",
  coverFileId: "evidence",
  imageFileIds: "evidence",
  demoUrl: "evidence",
  website: "evidence",
  listed: "review",
};

/** The id of the control of a field, which a link from another step moves focus to. */
export function fieldId(field: string) {
  return `solution-${field}`;
}
