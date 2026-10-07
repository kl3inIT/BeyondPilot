// What GET /api/search answers in the end-to-end tests: one query, "AI", with programs, solutions and
// a person; "nothing" finds nothing. Matched words in a snippet are between U+0002 and U+0003, as the
// backend sends them.

const mark = (word) => `\u0002${word}\u0003`;

const item = (fields) => ({
  subtitle: null,
  type: null,
  phase: null,
  startsOn: null,
  endsOn: null,
  coverFileId: null,
  externalUrl: null,
  organizationSlug: null,
  country: null,
  maturity: null,
  customerDeployments: null,
  industries: [],
  focusAreas: [],
  roles: [],
  skills: [],
  city: null,
  worksAt: null,
  photoFileId: null,
  closesAt: null,
  budgetMin: null,
  budgetMax: null,
  budgetToBeDetermined: null,
  currency: null,
  ...fields,
});

const solution = (slug, title, organization, summary, customerDeployments) =>
  item({
    kind: "solution",
    slug,
    title,
    subtitle: organization,
    summary,
    snippet: summary.replace(/\bAI\b/, mark("AI")),
    organizationSlug: organization.toLowerCase().replaceAll(" ", "-"),
    maturity: "pilot",
    customerDeployments,
    focusAreas: ["conversational_ai", "speech_voice"],
    industries: ["insurance"],
  });

const results = {
  solution: [
    solution(
      "voice-agent",
      "AI Voice Agent",
      "Revve AI",
      "Voice and chat AI agents for insurers.",
      1,
    ),
    solution(
      "claims-desk",
      "Claims Desk",
      "Nhanh",
      "Reads claim files with AI and prepares the assessment.",
      0,
    ),
    solution(
      "hotline-assist",
      "Hotline Assist",
      "Nhanh",
      "Answers inbound calls with AI in Vietnamese.",
      2,
    ),
    solution(
      "policy-chat",
      "Policy Chat",
      "Pocket Policy",
      "An AI assistant for policy questions.",
      0,
    ),
  ],
  program: [
    item({
      kind: "program",
      slug: "ai-youth-challenge",
      title: "AI Youth Challenge",
      subtitle: "GenAI Fund",
      summary: "A closed-door pitch for young AI builders in Australia.",
      snippet: `A closed-door pitch for young ${mark("AI")} builders in Australia.`,
      type: "pitch_competition",
      phase: "done",
      startsOn: "2026-04-27",
      endsOn: "2026-04-27",
    }),
    item({
      kind: "program",
      slug: "nextgen-japan",
      title: "NextGen AI Open Innovation Japan 2025",
      subtitle: "FPT",
      summary: "The Japan chapter of GenAI Open Innovation.",
      snippet: "The Japan chapter of GenAI Open Innovation.",
      type: "open_innovation_call",
      phase: "done",
      startsOn: "2025-09-26",
      endsOn: "2025-09-26",
      externalUrl: "https://genaifund.ai/japan",
    }),
  ],
  talent: [
    item({
      kind: "talent",
      slug: "hieu-nguyen",
      title: "Hieu Nguyen",
      subtitle: "Co-founder of Revve AI",
      summary: "Builds voice agents.",
      snippet: `Co-founder of Revve ${mark("AI")}`,
      roles: ["ai_engineer"],
      country: "VN",
    }),
  ],
  use_case: [
    item({
      kind: "use_case",
      slug: "6c1f8f2e-0b1a-4c56-9a3e-0d5b2f4e7a10",
      title: "AI claims triage for motor insurance",
      subtitle: null,
      summary: "A first assessment of every claim within an hour.",
      snippet: `A first assessment of every claim within an hour, by ${mark("AI")}.`,
      industries: ["insurance"],
      closesAt: "2026-11-30T16:59:00Z",
      budgetMin: 10000,
      budgetMax: 50000,
      budgetToBeDetermined: false,
      currency: "USD",
    }),
  ],
};

/** The order of the kinds in the All tab: the kind of the best result first. */
const kindOrder = ["solution", "program", "talent", "use_case"];

export function answerSearch(url) {
  if (url.pathname !== "/api/search") {
    return null;
  }
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return [400, { code: "REQUEST_INVALID" }];
  }
  const found =
    q.toLowerCase() === "ai" ? results : { solution: [], program: [], talent: [], use_case: [] };
  const counts = {
    all: found.solution.length + found.program.length + found.talent.length + found.use_case.length,
    program: found.program.length,
    solution: found.solution.length,
    talent: found.talent.length,
    useCase: found.use_case.length,
  };
  const kind = url.searchParams.get("kind");
  if (kind) {
    const total = kind === "use_case" ? counts.useCase : counts[kind];
    const page = Number(url.searchParams.get("page") ?? "1");
    return [200, { counts, items: page === 1 ? found[kind] : [], page, pageSize: 12, total }];
  }
  return [
    200,
    {
      counts,
      items: kindOrder.flatMap((each) => found[each].slice(0, 3)),
      page: 1,
      pageSize: 12,
      total: counts.all,
    },
  ];
}

// What Admin › AI reads: OpenRouter connected and in use with OpenAI's large model, and an index of
// four kinds in which two people were refused by the provider.
const aiProviders = {
  keysCanBeStored: true,
  embedding: {
    providerId: "5b0f4c1e-8a2d-4e7b-9c3a-1d2e3f4a5b6c",
    providerName: "OpenRouter",
    model: "openai/text-embedding-3-large",
    dimensions: 1536,
    since: "2026-10-06T07:10:00Z",
    embedded: 82,
    total: 86,
  },
  providers: [
    {
      id: "5b0f4c1e-8a2d-4e7b-9c3a-1d2e3f4a5b6c",
      vendor: "openrouter",
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      hasKey: true,
      inUse: true,
      updatedBy: "Đạt Phan",
      updatedAt: "2026-10-06T07:10:00Z",
      version: 0,
    },
  ],
  vendors: [
    {
      id: "openai",
      baseUrl: "https://api.openai.com/v1",
      models: ["text-embedding-3-large", "text-embedding-3-small"],
    },
    {
      id: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      models: ["openai/text-embedding-3-large", "openai/text-embedding-3-small"],
    },
  ],
  settingsVersion: 1,
};

const searchIndex = {
  semantic: {
    enabled: true,
    state: "on",
    providerName: "OpenRouter",
    model: "openai/text-embedding-3-large",
    pausedUntil: null,
    failure: null,
    lastBatchAt: "2026-10-06T07:58:00Z",
  },
  kinds: [
    { kind: "program", total: 19, listed: 19, embedded: 19, waiting: 0, heldBack: 0 },
    { kind: "solution", total: 24, listed: 21, embedded: 23, waiting: 1, heldBack: 0 },
    { kind: "talent", total: 37, listed: 35, embedded: 34, waiting: 1, heldBack: 2 },
    { kind: "use_case", total: 6, listed: 6, embedded: 6, waiting: 0, heldBack: 0 },
  ],
  heldBack: [
    {
      kind: "talent",
      itemId: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
      title: "Lan Pham",
      reason: "bad_request",
      attempts: 3,
      nextAttemptAt: "2026-10-06T14:00:00Z",
    },
    {
      kind: "talent",
      itemId: "8d2e3f4a-5b6c-4d7e-9f0a-1b2c3d4e5f6a",
      title: "Hieu Nguyen",
      reason: "unprocessable",
      attempts: 2,
      nextAttemptAt: "2026-10-06T09:00:00Z",
    },
  ],
  lastRebuild: { at: "2026-10-05T20:30:00Z", saved: 86, removed: 0 },
  settingsVersion: 1,
};

/** Admin › AI, for an operator only, as the backend answers it. */
export function answerSearchAdmin(url, account) {
  if (!url.pathname.startsWith("/api/search/admin/")) {
    return null;
  }
  if (account?.role !== "operator") {
    return [account ? 403 : 401, { code: "IDENTITY_OPERATOR_REQUIRED" }];
  }
  if (url.pathname === "/api/search/admin/providers") {
    return [200, aiProviders];
  }
  if (url.pathname === "/api/search/admin/index") {
    return [200, searchIndex];
  }
  return [404, {}];
}
