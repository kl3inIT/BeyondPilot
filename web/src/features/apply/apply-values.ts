import type {
  ApplicantOrganization,
  ApplicationView,
  FormQuestion,
  Me,
  SaveSolution,
  Solution,
} from "@/lib/api/generated";

import { draftOf, type ApplyDraft } from "./apply-draft";

/** Who a person without an organization applies as; a company is found or added, not typed here. */
export type Who = "individual" | "team" | "company";

/** A solution as step 2 edits it; a new one has no identifier until it is saved. */
export type SolutionDraft = {
  id: string | null;
  name: string;
  summary: string;
  problemsSolved: string;
  maturity: string;
  demoUrl: string;
};

/**
 * Everything the application form holds. `application` is the draft the backend keeps and
 * `solution` a record of its own, each saved as it changes; who applies and the team are kept with
 * the account when step 1 is left, and the confirmation is never stored.
 */
export type ApplyValues = {
  /** Empty until the person chooses: nobody is chosen for them. */
  who: Who | "";
  team: { name: string; size: string; website: string };
  application: ApplyDraft;
  solution: SolutionDraft;
  confirmed: boolean;
};

/** The solution step 2 starts from: one of the organization's by its identifier, or a new one. */
export function solutionDraftOf(view: ApplicationView, id: string | null): SolutionDraft {
  const found = view.solutions.find((solution) => solution.id === id);
  return {
    id: found?.id ?? null,
    name: found?.name ?? "",
    summary: found?.summary ?? "",
    problemsSolved: found?.problemsSolved ?? "",
    maturity: found?.maturity ?? "",
    demoUrl: "",
  };
}

/**
 * The answers with an empty one for every question that has none, so that each question's field
 * holds text. An answer to a question the program no longer asks is kept as it was stored. Answers
 * the same object when nothing is missing.
 */
export function answersFor(
  answers: Record<string, string>,
  questions: Pick<FormQuestion, "id">[],
): Record<string, string> {
  const missing = questions.filter((question) => answers[question.id] === undefined);
  return missing.length === 0
    ? answers
    : { ...answers, ...Object.fromEntries(missing.map((question) => [question.id, ""])) };
}

/** What the form starts from: the stored draft as `draftOf` reads it, and nothing chosen or confirmed. */
export function valuesOf(
  view: ApplicationView,
  account?: Pick<Me, "country" | "phone">,
): ApplyValues {
  const draft = draftOf(view, account);
  return {
    who: "",
    team: { name: "", size: "2_9", website: "" },
    application: { ...draft, answers: answersFor(draft.answers, view.program.questions) },
    solution: solutionDraftOf(view, draft.solutionId),
    confirmed: false,
  };
}

/** One person applying on their own is not asked about a team. */
export function appliesAlone(
  organization: ApplicationView["organization"],
  who: Who | "",
): boolean {
  return organization
    ? organization.type === "independent_builder"
    : who !== "team" && who !== "company";
}

/** The organization made for someone in none when step 1 is left: themselves by name, or their team. */
export function organizationBodyOf(
  values: Pick<ApplyValues, "who" | "team" | "application">,
): ApplicantOrganization {
  const contact = values.application.contact;
  return values.who === "individual"
    ? {
        kind: "individual",
        name: `${contact.firstName.trim()} ${contact.lastName.trim()}`,
        country: contact.country,
      }
    : {
        kind: "team",
        name: values.team.name.trim(),
        country: contact.country,
        teamSize: values.team.size as ApplicantOrganization["teamSize"],
        website: values.team.website.trim() || null,
      };
}

/**
 * What saving the solution of step 2 sends: what the step edits, and everything else as the
 * solution holds it now, so that the step changes nothing it does not show.
 */
export function solutionBodyOf(next: SolutionDraft, found: Solution): SaveSolution {
  return {
    name: next.name.trim(),
    summary: next.summary.trim() || null,
    problemsSolved: next.problemsSolved.trim() || null,
    valueProposition: found.valueProposition ?? null,
    focusAreas: found.focusAreas,
    industries: found.industries,
    maturity: (next.maturity || undefined) as SaveSolution["maturity"],
    deployment: found.deployment,
    website: found.website ?? null,
    demoUrl: next.demoUrl.trim() || found.demoUrl || null,
    traction: found.traction ?? null,
    builtWith: found.builtWith,
    languages: found.languages,
    bestCustomerProfile: found.bestCustomerProfile ?? null,
    deckFileId: found.deck?.fileId ?? null,
    logoFileId: found.logo?.fileId ?? null,
    coverFileId: found.cover?.fileId ?? null,
    imageFileIds: found.images.map((image) => image.fileId),
    offerIds: found.offers.map((offer) => offer.id),
    listed: found.listed,
    version: found.version,
  };
}
