// What the stub backend answers about reviewing the Tasco challenge's applications, for the web
// server's reads. What the browser writes is answered by each test.

const day = 24 * 60 * 60 * 1000;

// The Tasco challenge of the admin stub, so its Reviewers tab reads the program too.
export const judgedProgramId = "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c02";

export const criteria = [
  { id: "c0000000-0000-4000-8000-000000000001", name: "Practical impact", description: null },
  { id: "c0000000-0000-4000-8000-000000000002", name: "Credible execution", description: null },
];

const ids = {
  claim: "a0000000-0000-4000-8000-000000000001",
  plain: "a0000000-0000-4000-8000-000000000002",
  renew: "a0000000-0000-4000-8000-000000000003",
};

function head(operator, closed) {
  return {
    programId: judgedProgramId,
    slug: "insurance-ai-tasco",
    name: "AI for Insurance Challenge × Tasco",
    closesAt: new Date(Date.now() + (closed ? -1 : 9) * day).toISOString(),
    outcomesDueOn: "2026-10-16",
    closed,
    releasedAt: null,
    operator,
    criteria,
    choice: {
      id: "q0000000-0000-4000-8000-000000000001",
      label: "Direction",
      options: ["Buying", "Carrying", "Claiming"],
    },
  };
}

const applications = [
  {
    id: ids.claim,
    solutionName: "Claim Copilot",
    organizationName: "Pocket Policy",
    organizationType: "builder_team",
    country: "VN",
    choice: "Claiming",
    submittedAt: new Date(Date.now() - 3 * day).toISOString(),
    version: 1,
    reviewStatus: "shortlisted",
    average: 4.3,
    scored: 2,
    mine: "scored",
  },
  {
    id: ids.plain,
    solutionName: "Plain Cover",
    organizationName: "Plain Cover Pte",
    organizationType: "company",
    country: "SG",
    choice: "Buying",
    submittedAt: new Date(Date.now() - 2 * day).toISOString(),
    version: 2,
    reviewStatus: "under_review",
    average: null,
    scored: 0,
    mine: "none",
  },
  {
    id: ids.renew,
    solutionName: "Renew in a Minute",
    organizationName: "An Tran",
    organizationType: "independent_builder",
    country: "VN",
    choice: "Carrying",
    submittedAt: new Date(Date.now() - day).toISOString(),
    version: 1,
    reviewStatus: "not_selected",
    average: 2.5,
    scored: 1,
    mine: "conflict",
  },
];

export const plainCoverId = ids.plain;

function list(operator) {
  return {
    head: head(operator, false),
    items: applications.map((item) =>
      operator
        ? item
        : { ...item, reviewStatus: null, scored: null, average: item.mine === "scored" ? 4 : null },
    ),
    drafts: 4,
    withdrawn: 1,
  };
}

function application(operator) {
  return {
    head: head(operator, false),
    id: ids.plain,
    version: 2,
    submittedAt: applications[1].submittedAt,
    submitted: {
      email: "wei.ling@plaincover.example",
      contact: {
        firstName: "Wei Ling",
        lastName: "Tan",
        phone: "+65 8123 4567",
        country: "SG",
        linkedin: "https://www.linkedin.com/in/weilingtan",
      },
      organizationName: "Plain Cover Pte",
      organizationType: "company",
      country: "SG",
      teamSize: "10_49",
      website: null,
      teamBackground: "An insurance-wording team and two engineers.",
      solutionName: "Plain Cover",
      summary: "A plain-language explainer inside the purchase flow.",
      problemsSolved: "First-time car owners buy cover without knowing what it excludes.",
      maturity: "production",
      deck: {
        fileId: "f0000000-0000-4000-8000-000000000001",
        fileName: "plain-cover-deck.pdf",
        sizeBytes: 3100000,
      },
      builtWith: ["Anthropic Claude", "LangGraph"],
      traction: "One insurer in Singapore.",
      answers: [
        {
          questionId: "q0000000-0000-4000-8000-000000000001",
          label: "Direction",
          kind: "single_choice",
          value: "Buying",
          file: null,
        },
      ],
    },
    reviewStatus: operator ? "under_review" : null,
    mine: null,
    others: operator
      ? [
          {
            reviewer: "Minh Anh Le",
            role: "reviewer",
            scores: { [criteria[0].id]: 4, [criteria[1].id]: 4 },
            average: 4,
            note: "Strong on consent.",
            conflict: false,
            version: 1,
            savedAt: new Date(Date.now() - day).toISOString(),
          },
        ]
      : [],
    average: operator ? 4 : null,
    history: [
      {
        kind: "submitted",
        at: applications[1].submittedAt,
        version: 1,
        decision: null,
        reason: null,
        by: null,
      },
    ],
    position: 2,
    total: 3,
    previousId: ids.claim,
    nextId: ids.renew,
  };
}

/** The answer to a read of the review, or undefined when the path is not one of them. */
export function answerJudging(url, account) {
  const { pathname } = url;
  if (!pathname.startsWith("/api/proposal/review/")) {
    return undefined;
  }
  const operator = account?.role === "operator";
  const judge = account?.email === "judge@tasco.example";
  if (!account) {
    return [401, {}];
  }
  if (pathname === "/api/proposal/review/programs") {
    return [
      200,
      {
        items:
          operator || judge
            ? [
                {
                  id: judgedProgramId,
                  slug: "insurance-ai-tasco",
                  name: "AI for Insurance Challenge × Tasco",
                  closesAt: head(false, false).closesAt,
                  outcomesDueOn: "2026-10-16",
                  released: false,
                  applications: 3,
                  assessed: judge ? 2 : 1,
                },
              ]
            : [],
      },
    ];
  }
  if (!operator && !judge) {
    return [403, { code: "PROPOSAL_REVIEW_NOT_ALLOWED" }];
  }
  const base = `/api/proposal/review/programs/${judgedProgramId}`;
  if (pathname === `${base}/applications`) {
    return [200, list(operator)];
  }
  if (pathname === `/api/proposal/review/applications/${ids.plain}`) {
    return [200, application(operator)];
  }
  if (pathname === `${base}/criteria`) {
    return [200, { criteria, fixed: true }];
  }
  if (!operator) {
    return [403, { code: "IDENTITY_OPERATOR_REQUIRED" }];
  }
  if (pathname === `${base}/reviewers`) {
    return [
      200,
      {
        items: [
          {
            id: "r0000000-0000-4000-8000-000000000001",
            email: "judge@tasco.example",
            name: "Lan Vu",
            role: "reviewer",
            status: "active",
            invitedAt: new Date(Date.now() - 5 * day).toISOString(),
            expiresAt: new Date(Date.now() + 2 * day).toISOString(),
            assessed: 2,
          },
          {
            id: "r0000000-0000-4000-8000-000000000002",
            email: "thu.pham@tasco.example",
            name: null,
            role: "reviewer",
            status: "invited",
            invitedAt: new Date(Date.now() - day).toISOString(),
            expiresAt: new Date(Date.now() + 6 * day).toISOString(),
            assessed: 0,
          },
        ],
        applications: 3,
      },
    ];
  }
  if (pathname === `${base}/release`) {
    const item = (row) => ({
      id: row.id,
      solutionName: row.solutionName,
      organizationName: row.organizationName,
      organizationType: row.organizationType,
      country: row.country,
      average: row.average,
    });
    return [
      200,
      {
        head: head(true, true),
        ready: true,
        shortlisted: [item(applications[0]), item(applications[1])],
        notSelected: [item(applications[2])],
        undecided: [],
        withdrawn: 1,
        emails: {
          shortlistedSubject: "You're shortlisted for AI for Insurance Challenge × Tasco",
          shortlistedMessage: "Hi {organization},\n\n{solution} is shortlisted.\n\nGenAI Fund",
          notSelectedSubject: "Your application to AI for Insurance Challenge × Tasco",
          notSelectedMessage: "Hi {organization},\n\nNot this time.\n\nGenAI Fund",
        },
      },
    ];
  }
  return [404, {}];
}
