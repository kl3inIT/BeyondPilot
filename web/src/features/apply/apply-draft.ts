import type {
  ApplicationView,
  AttachedFile,
  ContactDetails,
  Me,
  SaveApplication,
} from "@/lib/api/generated";

/** What the application form holds while a person fills it in. */
export type ApplyDraft = {
  contact: Required<{ [Key in keyof ContactDetails]: string }>;
  teamBackground: string;
  solutionId: string | null;
  deck: AttachedFile | null;
  builtWith: string[];
  traction: string;
  answers: Record<string, string>;
};

/**
 * The draft a form starts from: the application as saved, or what the latest other one held. A
 * country or a phone number neither of them holds comes from the account.
 */
export function draftOf(
  view: ApplicationView,
  account?: Pick<Me, "country" | "phone">,
): ApplyDraft {
  const application = view.application;
  const start = application ?? view.previous ?? null;
  const contact = start?.contact ?? {};
  return {
    contact: {
      firstName: contact.firstName ?? "",
      lastName: contact.lastName ?? "",
      phone: contact.phone ?? account?.phone ?? "",
      country: contact.country ?? account?.country ?? "",
      linkedin: contact.linkedin ?? "",
    },
    teamBackground: application?.teamBackground ?? "",
    // The organization's only solution is the likely one; with several, the person chooses.
    solutionId:
      application?.solutionId ?? (view.solutions.length === 1 ? view.solutions[0].id : null),
    deck: start?.deck ?? null,
    builtWith: start?.builtWith ?? [],
    traction: start?.traction ?? "",
    answers: application?.answers ?? {},
  };
}

/** What the backend accepts as a phone number and as a LinkedIn address (proposal › ContactDetails). */
const phoneShape = /^\+?[0-9 ().-]*$/;
const linkedinShape = /^https:\/\/\S+$/;

/** The contact fields whose text the backend would refuse; an empty field is not one of them. */
export function invalidContact(draft: ApplyDraft): ("phone" | "linkedin")[] {
  const phone = draft.contact.phone.trim();
  const linkedin = draft.contact.linkedin.trim();
  return [
    phone !== "" && !phoneShape.test(phone) ? ("phone" as const) : null,
    linkedin !== "" && !linkedinShape.test(linkedin) ? ("linkedin" as const) : null,
  ].filter((field) => field !== null);
}

/**
 * The draft a save made while the person types may send: a field the backend would refuse is left
 * out, so one of them does not keep everything else from being saved.
 */
export function savable(draft: ApplyDraft): ApplyDraft {
  const invalid = invalidContact(draft);
  if (invalid.length === 0) {
    return draft;
  }
  const contact = { ...draft.contact };
  for (const field of invalid) {
    contact[field] = "";
  }
  return { ...draft, contact };
}

/** What a save sends: empty text is sent as nothing, so a draft holds only what was typed. */
export function saveBodyOf(draft: ApplyDraft, version: number | null): SaveApplication {
  const text = (value: string) => value.trim() || null;
  return {
    contact: {
      firstName: text(draft.contact.firstName),
      lastName: text(draft.contact.lastName),
      phone: text(draft.contact.phone),
      country: text(draft.contact.country),
      linkedin: text(draft.contact.linkedin),
    },
    teamBackground: text(draft.teamBackground),
    solutionId: draft.solutionId,
    deckFileId: draft.deck?.fileId ?? null,
    builtWith: draft.builtWith,
    traction: text(draft.traction),
    answers: Object.fromEntries(
      Object.entries(draft.answers).filter(([, value]) => value.trim() !== ""),
    ),
    version,
  };
}
