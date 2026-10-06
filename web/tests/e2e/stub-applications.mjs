// What the backend answers about applications when the web server reads them (tests/e2e/stub-backend.mjs). What the
// browser writes, a test answers itself, keeping its own state (tests/e2e/apply.spec.ts).

const day = 24 * 60 * 60 * 1000;

/** The questions of the AI for Insurance Challenge's form. */
export const tascoQuestions = [
  {
    id: "7c1e0a2b-0000-4000-8000-000000000001",
    kind: "single_choice",
    label: "Direction",
    help: "One of the eight directions, or something else entirely.",
    required: true,
    options: ["Buying", "Carrying", "Claiming", "Something else entirely"],
    maxLength: 2000,
  },
  {
    id: "7c1e0a2b-0000-4000-8000-000000000002",
    kind: "long_text",
    label: "How does your solution address the challenge?",
    help: "The improvement you expect, and what you're assuming.",
    required: true,
    options: [],
    maxLength: 600,
  },
  {
    id: "7c1e0a2b-0000-4000-8000-000000000003",
    kind: "file",
    label: "Your proposal to Tasco",
    help: "No more than two pages.",
    required: true,
    options: [],
    maxLength: 2000,
  },
  {
    id: "7c1e0a2b-0000-4000-8000-000000000004",
    kind: "confirm",
    label:
      "I've read the one hard constraint: no premium discounts, cashback or disguised price incentives.",
    help: null,
    required: true,
    options: [],
    maxLength: 2000,
  },
];

export function tascoForm() {
  return {
    id: "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c02",
    slug: "insurance-ai-tasco",
    name: "AI for Insurance Challenge × Tasco",
    opensAt: new Date(Date.now() - 12 * day).toISOString(),
    closesAt: new Date(Date.now() + 10 * day).toISOString(),
    outcomesDueOn: null,
    allowUpdatesUntilClose: true,
    open: true,
    questions: tascoQuestions,
  };
}

/** The application form of a person who belongs to no organization and never applied. */
export function emptyView(email) {
  return {
    program: tascoForm(),
    application: null,
    email,
    previous: null,
    organization: null,
    solutions: [],
  };
}

/** An application to the Tasco challenge, submitted three days ago with everything it needs. */
export const submittedId = "3e2d1c0b-0000-4000-8000-000000000030";

export function submittedView(email, organization) {
  return {
    program: {
      ...tascoForm(),
      outcomesDueOn: new Date(Date.now() + 11 * day).toISOString().slice(0, 10),
    },
    application: {
      id: submittedId,
      status: "submitted",
      contact: {
        firstName: "An",
        lastName: "Tran",
        phone: "+84 912 345 678",
        country: "VN",
        linkedin: "https://www.linkedin.com/in/antran",
      },
      teamBackground:
        organization.type === "independent_builder" ? null : "Two engineers from an insurer.",
      solutionId: "5a0b7c1d-0000-4000-8000-000000000010",
      deck: {
        fileId: "9d8c7b6a-0000-4000-8000-000000000041",
        fileName: "claim-copilot-deck.pdf",
        sizeBytes: 2400000,
      },
      builtWith: ["OpenAI GPT", "Whisper"],
      traction: "Two pilots with insurers.",
      answers: {
        [tascoQuestions[0].id]: "Claiming",
        [tascoQuestions[1].id]: "Claims reach a decision without a hotline call.",
        [tascoQuestions[2].id]: "9d8c7b6a-0000-4000-8000-000000000042",
        [tascoQuestions[3].id]: "true",
      },
      files: {
        [tascoQuestions[2].id]: {
          fileId: "9d8c7b6a-0000-4000-8000-000000000042",
          fileName: "pocket-policy-proposal.pdf",
          sizeBytes: 600000,
        },
      },
      submissions: 1,
      submittedAt: new Date(Date.now() - 3 * day).toISOString(),
      withdrawnAt: null,
      version: 3,
      updatedAt: new Date(Date.now() - 3 * day).toISOString(),
    },
    email,
    previous: null,
    organization,
    solutions: [
      {
        id: "5a0b7c1d-0000-4000-8000-000000000010",
        name: "Claim Copilot",
        summary: "A chat assistant that tells a driver what is covered.",
        problemsSolved: "Drivers wait on a hotline after a minor accident.",
        maturity: "pilot",
        complete: true,
      },
    ],
  };
}

const pocketPolicy = {
  id: "5a0b7c1d-0000-4000-8000-000000000020",
  name: "Pocket Policy",
  type: "builder_team",
  country: "VN",
  teamSize: "2_9",
  approved: true,
};

const anTran = {
  id: "5a0b7c1d-0000-4000-8000-000000000021",
  name: "An Tran",
  type: "independent_builder",
  country: "VN",
  teamSize: "just_me",
  approved: false,
};

export function answerApplication(url, session, email) {
  const { pathname } = url;
  if (!pathname.startsWith("/api/proposal/")) {
    return undefined;
  }
  if (!session) {
    return [401, {}];
  }
  // The owner of Pocket Policy has submitted; anyone else has not applied yet.
  const applied = session === "owner";
  if (pathname === "/api/proposal/programs/insurance-ai-tasco/application") {
    return [200, applied ? submittedView(email, pocketPolicy) : emptyView(email)];
  }
  if (pathname === "/api/proposal/applications") {
    const view = submittedView(email, pocketPolicy);
    const items = [
      {
        id: submittedId,
        programSlug: view.program.slug,
        programName: view.program.name,
        closesAt: view.program.closesAt,
        outcomesDueOn: view.program.outcomesDueOn,
        status: "submitted",
        organizationName: "Pocket Policy",
        solutionName: "Claim Copilot",
        submittedAt: view.application.submittedAt,
        updatedAt: view.application.updatedAt,
        outcome: null,
        next: {
          title: "Demo day",
          at: new Date(Date.now() + 18 * day).toISOString(),
          allDay: false,
        },
      },
      // An earlier program, closed and released, whose demo day is still to come.
      {
        id: "3e2d1c0b-0000-4000-8000-000000000031",
        programSlug: "ai-for-logistics",
        programName: "AI for Logistics Challenge",
        closesAt: new Date(Date.now() - 20 * day).toISOString(),
        outcomesDueOn: new Date(Date.now() - 6 * day).toISOString().slice(0, 10),
        status: "submitted",
        organizationName: "Pocket Policy",
        solutionName: "Route Copilot",
        submittedAt: new Date(Date.now() - 25 * day).toISOString(),
        updatedAt: new Date(Date.now() - 25 * day).toISOString(),
        outcome: "shortlisted",
        next: {
          title: "Demo day",
          at: new Date(Date.now() + 4 * day).toISOString(),
          allDay: false,
        },
      },
    ];
    return [200, { items: applied ? items : [] }];
  }
  if (pathname === `/api/proposal/applications/${submittedId}`) {
    return [200, submittedView(email, applied ? pocketPolicy : anTran)];
  }
  return [409, { status: 409, code: "PROPOSAL_NOT_OPEN" }];
}
