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
};

/** The order of the kinds in the All tab: the kind of the best result first. */
const kindOrder = ["solution", "program", "talent"];

export function answerSearch(url) {
  if (url.pathname !== "/api/search") {
    return null;
  }
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return [400, { code: "REQUEST_INVALID" }];
  }
  const found = q.toLowerCase() === "ai" ? results : { solution: [], program: [], talent: [] };
  const counts = {
    all: found.solution.length + found.program.length + found.talent.length,
    program: found.program.length,
    solution: found.solution.length,
    talent: found.talent.length,
  };
  const kind = url.searchParams.get("kind");
  if (kind) {
    const page = Number(url.searchParams.get("page") ?? "1");
    return [
      200,
      { counts, items: page === 1 ? found[kind] : [], page, pageSize: 12, total: counts[kind] },
    ];
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
