// What the Matched solutions page of a use case reads in the end-to-end tests, as the members of
// Pocket Policy and as operators read it. Two published use cases:
// - "Claims triage" asks for three things: one required capability, two optional ones and a condition
//   of delivery. A solution in each group, one the AI put in no group, one a member removed, one
//   GenAI Fund removed and one the AI has not read yet.
// - "Invoice capture" asks for one thing, as most use cases do, with a condition of delivery: one
//   solution in each of the first two groups and six in the last, which folds.
// And a family of use cases named "Document intake", each with a run at work: one solution read and
// three that wait. A test takes one of them for itself, replaces what the stub answers for it and
// pushes events into the stream of its changes, as a run does (see `serveMatchingLive`).

const matchedUseCaseId = "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0011";
const oneNeedUseCaseId = "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0021";

// Every identifier that starts like this, with three digits after it, is a "Document intake".
const runningUseCaseIds = /^0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a1\d{3}$/;

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
  id: `c4d1d47e-0000-4000-8000-${String(number).padStart(12, "0")}`,
  solutionId: `50101000-0000-4000-8000-${String(number).padStart(12, "0")}`,
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

// "Invoice capture": the one thing it asks for, and a condition of delivery.
const oneNeedRequirements = [requirements[0], { ...requirements[3], position: 2 }];

const oneNeedCandidates = [
  candidate(
    21,
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
      finding(2, "met", "SAP connector available", "profile", "The profile names a SAP connector."),
    ],
    { summary: "It reads invoices in production today.", unread: ["deck"] },
  ),
  candidate(
    22,
    "Sentosa Finance",
    "industry",
    [
      finding(1, "partly", "More than 1K invoices per month", "customer case 1", "Invoices only."),
      finding(2, "not_shown"),
    ],
    { country: "ID", maturity: "scaled", summary: "An insurer uses it for invoices." },
  ),
  ...["Docbase", "Paperline", "Scanwell", "Formica", "Ledgerly", "Inkstone"].map((name, index) =>
    candidate(
      23 + index,
      name,
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
      ],
      { country: "VN", summary: "Built on document intelligence." },
    ),
  ),
];

// "Document intake": the search found four solutions; the AI has read the first and reads the others.
const runningCandidates = [
  oneNeedCandidates[0],
  ...oneNeedCandidates
    .slice(1, 4)
    .map((one) => ({ ...one, judged: false, bucket: "none", findings: [], summary: null })),
];

const runningRun = {
  id: "7a1d0000-0000-4000-8000-000000000002",
  origin: "member",
  state: "running",
  stage: "reading",
  createdAt: "2026-10-09T03:00:00Z",
  startedAt: "2026-10-09T03:00:05Z",
  judged: 1,
  total: 4,
};

const useCases = {
  [matchedUseCaseId]: { title: "Claims triage", requirements, candidates, run },
  [oneNeedUseCaseId]: {
    title: "Invoice capture",
    requirements: oneNeedRequirements,
    candidates: oneNeedCandidates,
    run,
  },
};

const runningUseCase = {
  title: "Document intake",
  requirements: oneNeedRequirements,
  candidates: runningCandidates,
  run: runningRun,
};

/** What a test put in the place of the stub's answer for one "Document intake", by its identifier. */
const replaced = new Map();

/** The open streams of changes, by use case. */
const streams = new Map();

const findUseCase = (id) =>
  useCases[id] ?? (runningUseCaseIds.test(id) ? runningUseCase : undefined);

async function bodyOf(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
  }
  return text ? JSON.parse(text) : null;
}

/**
 * The stream of a use case's changes, and what a test does to it. Answers the request and returns true
 * when the path is one of these, false otherwise:
 * - `GET /api/matching/use-cases/{id}/events` is the stream itself, as the backend sends it: a comment
 *   at once, then whatever a test pushes, for as long as the browser listens.
 * - `PUT /test/matching/use-cases/{id}` replaces what the stub answers for the use case with the body;
 *   `null` puts the stub's own answer back.
 * - `POST /test/matching/use-cases/{id}/events` pushes `{ event, data }` to every open stream of it.
 * - `GET /test/matching/use-cases/{id}/events` says how many streams of it are open.
 */
export function serveMatchingLive(request, response, url, account) {
  const stream = /^\/api\/matching\/use-cases\/([0-9a-f-]{36})\/events$/.exec(url.pathname);
  if (stream) {
    const [, id] = stream;
    if (!account || !findUseCase(id)) {
      response.writeHead(account ? 404 : 401).end();
      return true;
    }
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    });
    response.write(":open\n\n");
    const open = streams.get(id) ?? new Set();
    streams.set(id, open.add(response));
    request.on("close", () => open.delete(response));
    return true;
  }
  const test = /^\/test\/matching\/use-cases\/([0-9a-f-]{36})(\/events)?$/.exec(url.pathname);
  if (!test) {
    return false;
  }
  const [, id, events] = test;
  const open = streams.get(id) ?? new Set();
  if (events && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ open: open.size }));
    return true;
  }
  void bodyOf(request).then((body) => {
    if (events) {
      for (const one of open) {
        one.write(`event:${body.event}\ndata:${JSON.stringify(body.data ?? {})}\n\n`);
      }
    } else if (body === null) {
      replaced.delete(id);
    } else {
      replaced.set(id, body);
    }
    response.writeHead(204).end();
  });
  return true;
}

/**
 * The reads of the Matched solutions page, as `[status, body]`; nothing for another path. An operator reads
 * the model and the steps; a member reads how many runs the day still allows.
 */
export function answerMatching(url, account) {
  const { pathname } = url;
  const id = /\/([0-9a-f-]{36})$/.exec(pathname)?.[1];
  const useCase = id ? findUseCase(id) : undefined;
  if (!useCase) {
    return undefined;
  }
  const paths = {
    mine: `/api/usecase/mine/${id}`,
    administered: `/api/usecase/admin/use-cases/${id}`,
    matching: `/api/matching/use-cases/${id}`,
  };
  if (!Object.values(paths).includes(pathname)) {
    return undefined;
  }
  if (!account) {
    return [401, {}];
  }
  const operator = account.role === "operator";
  if (pathname === paths.mine) {
    return [200, { ...mine, id, title: useCase.title }];
  }
  if (pathname === paths.administered) {
    return operator ? [200, { ...administered, id, title: useCase.title }] : [403, {}];
  }
  if (replaced.has(id)) {
    return [200, replaced.get(id)];
  }
  return [
    200,
    {
      useCaseId: id,
      operator,
      modelChosen: true,
      requirements: useCase.requirements,
      candidates: useCase.candidates,
      run: operator ? { ...useCase.run, modelName: "claude-sonnet-4-5" } : useCase.run,
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
