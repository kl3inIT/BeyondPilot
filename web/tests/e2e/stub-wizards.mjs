// The two forms written in steps, as the web server reads them: the proposal a member writes to a
// use case, and the draft of a use case an organization writes. The stub keeps nothing between
// calls, so a test names the state it stands in with the STUB_SCENE cookie, which the web server
// forwards with the session; what the browser writes is answered by the test, with page.route.

/** The published use case the proposals of these tests are for (stub-directories.mjs). */
export const proposalUseCaseId = "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0002";
export const proposalId = "7a1d2c3b-0000-4000-8000-000000000051";
/** A use case of Pocket Policy that is still a draft. */
export const draftUseCaseId = "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0301";

/** A solution of Pocket Policy (stub-workspace.mjs), as a proposal names it. */
export const policyChat = {
  id: "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e11",
  name: "Policy Chat",
  slug: "policy-chat",
  summary: "Policy Chat for insurers.",
  logoFileId: null,
  viewKey: "f0e1d2c3-0000-4000-8000-000000000011",
};

export const minh = {
  accountId: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a04",
  name: "Minh Trần",
  email: "minh.tran@pocketpolicy.example",
};
export const siti = {
  accountId: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a12",
  name: "Siti Rahma",
  email: "siti@pocketpolicy.example",
};
/** Someone a stored draft names who has left the organization since. */
const left = {
  accountId: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a99",
  name: "Bảo Ngô",
  email: "bao.ngo@pocketpolicy.example",
};

export const proposalDeck = {
  fileId: "d0c1a2b3-4c5d-4e6f-8a9b-0c1d2e3f4a51",
  fileName: "pocket-policy-proposal.pdf",
  sizeBytes: 1_800_000,
};

const unsent = {
  id: proposalId,
  status: "draft",
  editableUntil: null,
  editedAt: null,
  sender: null,
  sentAt: null,
  sentBy: null,
};

/**
 * A draft as an earlier version of the form left it: one of its two people has left the
 * organization, and nobody is the primary contact.
 */
const storedProposal = {
  ...unsent,
  approach: "Policy Chat answers a policyholder's question from the policy itself.",
  deck: null,
  solutions: [policyChat],
  team: [
    { ...left, role: "Advisor", primary: false },
    { ...siti, role: "Engineer", primary: false },
  ],
  updatedAt: "2026-10-09T03:00:00Z",
  version: 4,
};

/** A proposal that was sent and may still be edited. */
const sentProposal = {
  ...unsent,
  status: "sent",
  approach: "Policy Chat answers a policyholder's question from the policy itself.",
  deck: proposalDeck,
  solutions: [policyChat],
  team: [{ ...siti, role: "Engineer", primary: true }],
  sentAt: "2026-10-10T03:00:00Z",
  sentBy: { name: minh.name, email: minh.email, country: "SG", phone: "+65 6123 4567" },
  editableUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: "2026-10-10T03:00:00Z",
  version: 7,
};

/** The form of the use case as one account reads it, holding the proposal of the scene. */
export function proposalForm(session, scene) {
  const belongs = session === "owner" || session === "member";
  return {
    useCase: {
      id: proposalUseCaseId,
      title: "Claims triage with document intelligence",
      closesAt: "2026-12-31T16:59:00Z",
    },
    organization: belongs
      ? {
          id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
          name: "Pocket Policy",
          logoFileId: null,
          approved: true,
        }
      : null,
    members: belongs
      ? [
          { ...minh, self: session === "owner" },
          { ...siti, self: session === "member" },
        ]
      : [],
    proposal: scene === "draft" ? storedProposal : scene === "sent" ? sentProposal : null,
  };
}

/** A draft that holds everything a use case needs, with one requirement. */
export const draftUseCase = {
  id: draftUseCaseId,
  title: "Invoice matching",
  status: "draft",
  organizationName: "Pocket Policy",
  industry: "insurance",
  technologies: ["document_intelligence"],
  problemStatement: "Finance matches invoices to purchase orders by hand.",
  expectedOutcomes: "Match nine invoices in ten without a person.",
  currentProcess: "Two people compare each invoice with its order.",
  currentSolutions: null,
  targetUsers: "The finance team.",
  requirements: [{ necessity: "required", statement: "Reads scanned invoices" }],
  dataReadiness: "Two years of invoices are stored as PDF.",
  integrationRequirements: "Connects to SAP.",
  attachments: [],
  currency: "USD",
  budgetMin: null,
  budgetMax: null,
  budgetToBeDetermined: true,
  budgetMembersOnly: false,
  timelineMinWeeks: 8,
  timelineMaxWeeks: 12,
  closesAt: "2026-12-31T16:59:00Z",
  hideOrganizationName: false,
  editable: true,
  complete: true,
  changedSinceReview: false,
  lastEditedBy: { name: "Minh Trần", genaiFund: false, you: true },
  submittedAt: null,
  publishedAt: null,
  reviewNote: null,
  updatedAt: "2026-10-10T03:00:00Z",
  version: 5,
};

/**
 * The answer to a read of one of the two forms, as `[status, body]`; nothing for another path.
 * `session` names the account and `scene` the state the test stands in.
 */
export function answerWizards(url, session, scene) {
  const { pathname } = url;
  if (pathname === `/api/proposal/use-cases/${proposalUseCaseId}/proposal`) {
    return session ? [200, proposalForm(session, scene)] : [401, {}];
  }
  if (pathname === `/api/usecase/mine/${draftUseCaseId}`) {
    if (!session) {
      return [401, {}];
    }
    // Once sent, the use case waits for GenAI Fund and its members only read it.
    return [
      200,
      scene === "review"
        ? {
            ...draftUseCase,
            status: "in_review",
            editable: false,
            submittedAt: "2026-10-11T03:00:00Z",
            submittedBy: draftUseCase.lastEditedBy,
          }
        : draftUseCase,
    ];
  }
  return undefined;
}
