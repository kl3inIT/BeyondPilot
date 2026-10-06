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

export function answerApplication(url, session, email) {
  const { pathname } = url;
  if (!pathname.startsWith("/api/proposal/")) {
    return undefined;
  }
  if (!session) {
    return [401, {}];
  }
  if (pathname === "/api/proposal/programs/insurance-ai-tasco/application") {
    return [200, emptyView(email)];
  }
  if (pathname === "/api/proposal/applications") {
    return [200, { items: [] }];
  }
  return [409, { status: 409, code: "PROPOSAL_NOT_OPEN" }];
}
