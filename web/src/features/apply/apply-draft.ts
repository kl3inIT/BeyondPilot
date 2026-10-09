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
