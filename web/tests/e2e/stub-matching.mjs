// What the Candidates page of a use case reads in the end-to-end tests: the published use case
// "Claims triage" of Pocket Policy as its members and as operators read it, and the solutions matched
// to it. One required capability, two optional ones and a condition of delivery; a candidate in each
// group, one judged into no group, one a member removed, one GenAI Fund removed and one that waits
// to be judged.

const matchedUseCaseId = "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0011";

const person = (name, more = {}) => ({ name, genaiFund: false, you: false, ...more });

const brief = {
  id: matchedUseCaseId,
  title: "Claims triage",
  status: "approved",
  industry: "insurance",
  technologies: ["document_intelligence"],
  problemStatement: "Claims handlers spend hours sorting incoming documents.",
  expectedOutcomes: null,
  currentProcess: null,
  currentSolutions: null,
  targetUsers: null,
  dataReadiness: null,
  integrationRequirements: "Connects to SAP.",
  requirements: [{ necessity: "required", statement: "Reads claim forms and invoices" }],
  attachments: [],
  budgetMin: null,
  budgetMax: null,
  budgetToBeDetermined: true,
  budgetMembersOnly: false,
  currency: "USD",
  timelineMinWeeks: null,
  timelineMaxWeeks: null,
  hideOrganizationName: false,
  closesAt: "2026-12-31T16:59:00Z",
  submittedAt: "2026-10-06T03:00:00Z",
  submittedBy: person("Minh Trần"),
  publishedAt: "2026-10-07T03:00:00Z",
  reviewNote: null,
  updatedAt: "2026-10-07T03:00:00Z",
  version: 3,
};

const mine = {
  ...brief,
  organizationName: "Pocket Policy",
  editable: false,
  complete: true,
  changedSinceReview: false,
  lastEditedBy: person("Minh Trần", { you: true }),
};

const administered = {
  ...brief,
  organization: {
    id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
    name: "Pocket Policy",
    logoFileId: null,
  },
  programs: [],
  createdAt: "2026-10-05T03:00:00Z",
  createdBy: person("Minh Trần"),
  reviewedAt: "2026-10-07T03:00:00Z",
  reviewedBy: person("Đạt Phan", { genaiFund: true }),
};

const requirements = [
  {
    position: 1,
    kind: "capability",
    necessity: "required",
    label: "Read documents",
    statement: "Reads claim forms and invoices and takes out their fields",
    quote: "sorting incoming documents",
  },
  {
    position: 2,
    kind: "capability",
    necessity: "optional",
    label: "Check rules",
    statement: "Checks each claim against the payment rules",
    quote: "Claims handlers spend hours",
  },
  {
    position: 3,
    kind: "capability",
    necessity: "optional",
    label: "Approval flow",
    statement: "Routes a claim to the right approver",
    quote: "Claims handlers",
  },
  {
    position: 4,
    kind: "constraint",
    necessity: "required",
    label: "SAP integration",
    statement: "Connects to SAP",
    quote: "Connects to SAP",
  },
];

const finding = (requirement, status, quote = "", source = "", reason = "") => ({
  requirement,
  status,
  quote,
  source,
  reason,
  quoteState: quote ? "exact" : "none",
});

const candidate = (number, name, bucket, findings, more = {}) => ({
  id: `c4d1d47e-0000-4000-8000-00000000000${number}`,
  solutionId: `50101000-0000-4000-8000-00000000000${number}`,
  solutionName: name,
  solutionSlug: name.toLowerCase().replaceAll(" ", "-"),
  organizationName: name,
  bucket,
  decision: "none",
  origin: "recommended",
  judged: true,
  listed: true,
  country: "SG",
  maturity: "production",
  findings,
  requiredMet: findings.some((one) => one.requirement === 1 && one.status === "met") ? 1 : 0,
  requiredTotal: 1,
  unread: [],
  ...more,
});

const candidates = [
  candidate(
    1,
    "Staple AI",
    "direct",
    [
      finding(
        1,
        "met",
        "extracts and verifies the content",
        "website 2",
        "It reads documents and takes out their fields.",
      ),
      finding(
        2,
        "partly",
        "flags unusual invoices",
        "deck p.6",
        "It flags, it does not check rules.",
      ),
      finding(3, "not_shown"),
      finding(4, "met", "SAP connector available", "profile", "The profile names a SAP connector."),
    ],
    { summary: "It reads claim documents in production today.", unread: ["website"] },
  ),
  candidate(
    2,
    "Sentosa Finance",
    "industry",
    [
      finding(1, "partly", "More than 1K invoices per month", "customer case 1", "Invoices only."),
      finding(2, "met", "Double payment and missing invoices", "profile", "It checks payments."),
      finding(3, "not_shown"),
      finding(4, "not_shown"),
    ],
    { country: "ID", maturity: "scaled", summary: "An insurer uses it for invoices." },
  ),
  candidate(
    3,
    "Docbase",
    "technology",
    [
      finding(
        1,
        "partly",
        "extracting data from PDFs and images",
        "website",
        "A general extractor.",
      ),
      finding(2, "not_shown"),
      finding(3, "not_shown"),
      finding(4, "not_shown"),
    ],
    { country: "VN", listed: false, summary: "Built on document intelligence." },
  ),
  candidate(4, "OmniShelf", "none", [finding(1, "not_shown")], {
    summary: "It reads shelf photos, not claims.",
  }),
  candidate(5, "Peakflo", "technology", [finding(1, "met", "Millions of invoices", "deck p.6")], {
    decision: "removed",
    removedReason: "duplicate",
    removedNote: "same as Staple AI",
    removedBy: "Siti Rahma",
    removedByOperator: false,
    removedAt: "2026-10-08T04:20:00Z",
  }),
  candidate(6, "Fintelite", "technology", [finding(1, "partly", "document checks", "profile")], {
    decision: "removed",
    removedReason: "does_not_solve",
    removedBy: "Đạt Phan",
    removedByOperator: true,
    removedAt: "2026-10-08T03:41:00Z",
  }),
  candidate(7, "Kira Claims", "none", [], {
    judged: false,
    origin: "added",
    country: "VN",
    maturity: "pilot",
  }),
];

const run = {
  id: "7a1d0000-0000-4000-8000-000000000001",
  origin: "approved",
  state: "done",
  createdAt: "2026-10-08T03:00:00Z",
  startedAt: "2026-10-08T03:10:00Z",
  endedAt: "2026-10-08T03:14:00Z",
  judged: 6,
  total: 6,
};

/**
 * The reads of the Candidates page, as `[status, body]`; nothing for another path. An operator reads
 * the model and the steps; a member reads how many runs the day still allows.
 */
export function answerMatching(url, account) {
  const { pathname } = url;
  const paths = {
    mine: `/api/usecase/mine/${matchedUseCaseId}`,
    administered: `/api/usecase/admin/use-cases/${matchedUseCaseId}`,
    matching: `/api/matching/use-cases/${matchedUseCaseId}`,
  };
  if (!Object.values(paths).includes(pathname)) {
    return undefined;
  }
  if (!account) {
    return [401, {}];
  }
  const operator = account.role === "operator";
  if (pathname === paths.mine) {
    return [200, mine];
  }
  if (pathname === paths.administered) {
    return operator ? [200, administered] : [403, {}];
  }
  return [
    200,
    {
      useCaseId: matchedUseCaseId,
      operator,
      modelChosen: true,
      requirements,
      candidates,
      run: operator ? { ...run, modelName: "claude-sonnet-4-5" } : run,
      steps: operator
        ? [
            {
              name: "judgment",
              takenIn: 6,
              givenOut: 6,
              calls: 6,
              inputTokens: 42000,
              outputTokens: 5200,
              millis: 190000,
            },
          ]
        : [],
      // As Spring answers: a value that is absent is null, not left out. An operator has no limit.
      runsLeftToday: operator ? null : 2,
    },
  ];
}
