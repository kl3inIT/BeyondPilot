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

/** A draft with its solution and approach written, and neither the PDF nor the details. */
const storedProposal = {
  ...unsent,
  approach: "Policy Chat answers a policyholder's question from the policy itself.",
  deck: null,
  teamBackground: null,
  solutions: [policyChat],
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
  teamBackground: null,
  sentAt: "2026-10-10T03:00:00Z",
  sentBy: { name: minh.name, email: minh.email, country: "SG", phone: "+65 6123 4567" },
  editableUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: "2026-10-10T03:00:00Z",
  version: 7,
};

/** A proposal that was sent and taken back: a draft again, saying when it was. */
const withdrawnProposal = {
  ...storedProposal,
  approach: "Policy Chat answers a policyholder's question from the policy itself.",
  deck: proposalDeck,
  withdrawnAt: "2026-10-12T03:00:00Z",
  version: 8,
};

/** A sent proposal whose use case has closed: it is only read. */
const closedProposal = { ...sentProposal, editableUntil: null };

/** A sent proposal whose decision the posting organization has sent: shortlisted, or not selected. */
const shortlistedProposal = {
  ...sentProposal,
  outcome: "shortlisted",
  outcomeSentAt: "2026-10-13T03:00:00Z",
};
const declinedProposal = {
  ...sentProposal,
  outcome: "declined",
  outcomeSentAt: "2026-10-13T03:00:00Z",
};

/** The form of the use case as one account reads it, holding the proposal of the scene. */
export function proposalForm(session, scene) {
  const belongs = session === "owner" || session === "member";
  return {
    useCase: {
      id: proposalUseCaseId,
      title: "Claims triage with document intelligence",
      closesAt: scene === "closed" ? "2026-10-01T16:59:00Z" : "2026-12-31T16:59:00Z",
    },
    organization: belongs
      ? {
          id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
          name: "Pocket Policy",
          logoFileId: null,
          approved: true,
          owner: session === "owner",
          type: "company",
        }
      : null,
    proposal:
      scene === "draft"
        ? storedProposal
        : scene === "sent"
          ? sentProposal
          : scene === "shortlisted"
            ? shortlistedProposal
            : scene === "declined"
              ? declinedProposal
              : scene === "withdrawn"
                ? withdrawnProposal
                : scene === "closed"
                  ? closedProposal
                  : null,
  };
}

/** The proposals the use case of these tests received, as the organization that posted it reads them. */
export const receivedIds = {
  northwind: "7a1d2c3b-0000-4000-8000-000000000061",
  lumen: "7a1d2c3b-0000-4000-8000-000000000062",
  orbit: "7a1d2c3b-0000-4000-8000-000000000063",
};

const receivedNames = {
  [receivedIds.northwind]: "Northwind Analytics",
  [receivedIds.lumen]: "Lumen AI",
  [receivedIds.orbit]: "Orbit Claims",
};

/** What was decided in a scene: nothing in `received`, two decisions in `decided`, and the same told to their senders in `told`. */
function decisionOf(scene, id) {
  if (scene !== "decided" && scene !== "told") {
    return {};
  }
  const decision = { [receivedIds.northwind]: "shortlisted", [receivedIds.lumen]: "declined" }[id];
  return decision
    ? {
        decision,
        decidedAt: "2026-10-13T03:00:00Z",
        decidedBy: "Hoa Lê",
        outcomePending: scene === "decided",
        ...(scene === "told" && { outcomeSentAt: "2026-10-13T04:00:00Z" }),
      }
    : {};
}

const receivedUseCase = {
  id: proposalUseCaseId,
  title: "Claims triage with document intelligence",
  closesAt: "2026-12-31T16:59:00Z",
};

function receivedSummary(scene, id, sentAt) {
  return {
    id,
    organizationName: receivedNames[id],
    organizationLogoFileId: null,
    solutionNames: ["Policy Chat"],
    organizationApproved: true,
    contactName: minh.name,
    sentAt,
    editedAt: null,
    outcomePending: false,
    ...decisionOf(scene, id),
  };
}

/** The list of received proposals in a scene, with the counts the tabs show. */
export function receivedList(scene) {
  const items = [
    receivedSummary(scene, receivedIds.orbit, "2026-10-12T03:00:00Z"),
    receivedSummary(scene, receivedIds.lumen, "2026-10-11T03:00:00Z"),
    receivedSummary(scene, receivedIds.northwind, "2026-10-10T03:00:00Z"),
  ];
  return {
    useCase: receivedUseCase,
    items,
    shortlisted: items.filter((item) => item.decision === "shortlisted").length,
    declined: items.filter((item) => item.decision === "declined").length,
    pending: items.filter((item) => item.outcomePending).length,
  };
}

/** One received proposal in a scene. */
export function receivedProposal(scene, id) {
  const line = receivedList(scene).items.find((item) => item.id === id);
  return {
    ...line,
    approach: "Policy Chat answers a policyholder's question from the policy itself.",
    deck: proposalDeck,
    solutions: [policyChat],
    sentBy: sentProposal.sentBy,
    teamBackground: null,
    useCase: receivedUseCase,
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
  if (pathname === `/api/proposal/use-cases/${proposalUseCaseId}/proposals`) {
    return session ? [200, receivedList(scene)] : [401, {}];
  }
  const received = pathname.startsWith("/api/proposal/use-case-proposals/")
    ? pathname.split("/").at(-1)
    : undefined;
  if (received && received in receivedNames) {
    return session ? [200, receivedProposal(scene, received)] : [401, {}];
  }
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
