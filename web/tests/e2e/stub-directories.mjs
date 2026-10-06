// What the stub backend holds of the public directories: approved solutions with the organizations
// behind them and their customer deployments, and approved talent profiles. Anyone reads these.

const pocketPolicy = {
  slug: "pocket-policy",
  name: "Pocket Policy",
  type: "company",
  country: "SG",
  industries: ["insurance", "banking_finance"],
  description: "Assistants for insurers across Southeast Asia.",
  website: "https://www.pocketpolicy.example/",
};
const lumenHealth = {
  slug: "lumen-health",
  name: "Lumen Health",
  type: "builder_team",
  country: "VN",
  industries: [],
  description: null,
  website: null,
};
const organizations = [pocketPolicy, lumenHealth];

function solution(organization, name, more) {
  return {
    slug: name.toLowerCase().replaceAll(" ", "-"),
    name,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    country: organization.country,
    summary: `${name} for insurers.`,
    problemsSolved: "Policy holders wait days for an answer.",
    valueProposition: "An answer in seconds, in Vietnamese and English.",
    traction: null,
    builtWith: [],
    languages: [],
    bestCustomerProfile: null,
    website: "https://pocketpolicy.example",
    demoUrl: null,
    deck: null,
    listed: true,
    focusAreas: ["conversational_ai"],
    industries: ["insurance"],
    deployment: ["cloud_saas"],
    maturity: "pilot",
    ...more,
  };
}

/** The approved solutions, the most recently approved first. */
const solutions = [
  solution(pocketPolicy, "Policy Chat", {
    maturity: "production",
    demoUrl: "https://pocketpolicy.example/demo",
    deck: { fileName: "policy-chat-deck.pdf", sizeBytes: 3250586 },
    languages: ["vi", "en"],
    builtWith: ["Python", "PostgreSQL"],
    bestCustomerProfile: "Insurers with a call centre of fifty seats or more.",
  }),
  solution(lumenHealth, "Clinic Triage", {
    summary: "Triage for clinics before the first visit.",
    industries: ["healthcare"],
    maturity: "prototype",
    website: null,
  }),
  solution(pocketPolicy, "Claims Vision", {
    focusAreas: ["computer_vision", "document_processing", "process_automation", "ai_agents"],
  }),
  solution(pocketPolicy, "Underwriting Radar", { focusAreas: ["predictive_analytics"] }),
  solution(pocketPolicy, "Agent Coach", { focusAreas: ["speech_voice"] }),
  solution(pocketPolicy, "Broker Desk", { focusAreas: ["search_knowledge"] }),
];

/** Approved but unlisted: out of the directory, read by its address. */
const unlisted = solution(pocketPolicy, "Private Pilot", { listed: false });

/** The approved customer deployments, the most recently approved first. */
const deployments = [
  {
    id: "be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f02",
    title: "Renewals at Mekong Life",
    customer: "Mekong Life",
    stage: "production",
    problem: "Renewal questions filled the call centre every quarter.",
    delivered: "A chat assistant on the renewals page.",
    channels: "Chat",
    languages: null,
    period: null,
    result: "Half of renewals answered without an agent.",
    solutionName: "Policy Chat",
    solutionSlug: "policy-chat",
    approvedAt: "2026-10-01T03:00:00Z",
  },
];

const deploymentsOf = (slug) => deployments.filter((item) => item.solutionSlug === slug);

/** The members of a record that its entry in a list carries. */
const only = (record, ...members) =>
  Object.fromEntries(members.map((member) => [member, record[member]]));

const summaryOf = (item) => ({
  ...only(
    item,
    "slug",
    "name",
    "organizationName",
    "organizationSlug",
    "country",
    "summary",
    "focusAreas",
    "industries",
    "maturity",
  ),
  customerDeployments: deploymentsOf(item.slug).length,
});

function person(name, more) {
  return {
    slug: name.toLowerCase().replaceAll(" ", "-"),
    name,
    headline: "Ships assistants into call centres",
    bio: "Five years of putting language models in front of customers.",
    country: "VN",
    website: "https://www.linkedin.com/in/example",
    roles: ["forward_deployed_engineer"],
    skills: ["Python", "RAG"],
    engagement: ["contract", "advisory"],
    photoFileId: null,
    city: "Ho Chi Minh City",
    languages: ["vi", "en"],
    industries: ["insurance"],
    worksAt: "Revee AI",
    projects: [
      {
        title: "Claims assistant for an insurer",
        year: 2025,
        summary: null,
        url: null,
        stage: "in_production",
      },
    ],
    ...more,
  };
}

/** The approved talent profiles, the most recently approved first. */
const talent = [
  person("Linh Nguyễn", { slug: "linh-nguyen" }),
  person("Arif Hidayat", {
    headline: "ML engineer for document pipelines",
    country: "ID",
    roles: ["ml_engineer"],
    skills: ["PyTorch", "OCR"],
    projects: [],
    languages: [],
    city: null,
    worksAt: null,
    website: null,
  }),
  // The operator of these tests has a profile of their own.
  person("Đạt Phan", { slug: "dat-phan", roles: ["ai_consultant"], skills: ["Strategy"] }),
];

const personSummaryOf = (item) => ({
  ...only(item, "slug", "name", "headline", "country", "city", "roles", "skills"),
  photoFileId: item.photoFileId,
  projectCount: item.projects.length,
  leadProject: item.projects[0] ?? null,
});

const has = (text, ...fields) =>
  !text || fields.some((field) => (field ?? "").toLowerCase().includes(text.toLowerCase()));

function page(url, items) {
  const sorted =
    url.searchParams.get("sort") === "name"
      ? items.toSorted((one, other) => one.name.localeCompare(other.name))
      : items;
  return { items: sorted, page: 1, pageSize: 25, total: sorted.length };
}

/** The published use cases, the most recently published first; the third is anonymous and its budget is hidden. */
const useCases = [
  {
    id: "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0001",
    title: "Voice assistant for vehicle owners",
    organizationName: "Pocket Policy",
    industry: "automotive_mobility",
    goal: "Cut hotline calls by 40%.",
    technologies: ["voice_ai", "conversational_ai"],
    budgetMin: 15000,
    budgetMax: 40000,
    budgetToBeDetermined: false,
    budgetMembersOnly: false,
    timelineMinWeeks: 8,
    timelineMaxWeeks: 12,
    closesAt: "2026-12-31T16:59:00Z",
    publishedAt: "2026-10-02T02:00:00Z",
  },
  {
    id: "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0002",
    title: "Claims triage with document intelligence",
    organizationName: "Lumen Health",
    industry: "insurance",
    goal: "Route claims to the right team on arrival.",
    technologies: ["document_intelligence"],
    budgetMin: null,
    budgetMax: null,
    budgetToBeDetermined: true,
    budgetMembersOnly: false,
    timelineMinWeeks: 6,
    timelineMaxWeeks: 10,
    closesAt: "2026-11-15T16:59:00Z",
    publishedAt: "2026-10-01T02:00:00Z",
  },
  {
    id: "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0003",
    title: "Demand forecasting for a retail chain",
    organizationName: null,
    industry: "retail_ecommerce",
    goal: "Forecast weekly demand per store.",
    technologies: ["predictive_analytics", "anomaly_detection", "recommendation"],
    budgetMin: null,
    budgetMax: null,
    budgetToBeDetermined: false,
    budgetMembersOnly: true,
    timelineMinWeeks: 12,
    timelineMaxWeeks: 16,
    closesAt: "2026-12-01T16:59:00Z",
    publishedAt: "2026-09-30T02:00:00Z",
  },
];

/** The public list of use cases: the search looks in the title, the goal and the organization's name. */
function pageOfUseCases(url) {
  const { searchParams: query } = url;
  const sort = query.get("sort") ?? "newest";
  const items = useCases
    .filter(
      (item) =>
        has(query.get("q"), item.title, item.goal, item.organizationName) &&
        (!query.get("industry") || item.industry === query.get("industry")),
    )
    .toSorted((one, other) =>
      sort === "deadline"
        ? one.closesAt.localeCompare(other.closesAt)
        : sort === "budget"
          ? (other.budgetMax ?? 0) - (one.budgetMax ?? 0)
          : other.publishedAt.localeCompare(one.publishedAt),
    );
  return { items, page: 1, pageSize: 10, total: items.length };
}

const missing = [404, { status: 404, code: "NOT_FOUND" }];

/** The answer to a read of the public directories, as `[status, body]`; nothing for another path. */
export function answerDirectory(url) {
  const { pathname, searchParams: query } = url;
  if (pathname === "/api/usecase/use-cases") {
    return [200, pageOfUseCases(url)];
  }
  const [, area, list, slug] = /^\/api\/(\w+)\/(\w+)(?:\/([^/]+))?$/.exec(pathname) ?? [];

  if (area === "solution" && list === "solutions") {
    if (slug) {
      const found = [...solutions, unlisted].find((item) => item.slug === slug);
      return found ? [200, { ...found, customerDeployments: deploymentsOf(slug) }] : missing;
    }
    const items = solutions.filter(
      (item) =>
        has(query.get("q"), item.name, item.summary) &&
        (!query.get("organization") || item.organizationSlug === query.get("organization")) &&
        (!query.get("industry") || item.industries.includes(query.get("industry"))) &&
        (!query.get("focusArea") || item.focusAreas.includes(query.get("focusArea"))) &&
        (!query.get("maturity") || item.maturity === query.get("maturity")),
    );
    return [200, page(url, items.map(summaryOf))];
  }
  if (area === "solution" && list === "deployments" && !slug) {
    const owned = solutions
      .filter((item) => item.organizationSlug === query.get("organization"))
      .map((item) => item.slug);
    return [
      200,
      page(
        url,
        deployments.filter((item) => owned.includes(item.solutionSlug)),
      ),
    ];
  }
  if (area === "organization" && list === "organizations" && slug) {
    const found = organizations.find((item) => item.slug === slug);
    return found ? [200, found] : missing;
  }
  if (area === "talent" && list === "profiles") {
    if (slug) {
      const found = talent.find((item) => item.slug === slug);
      return found ? [200, found] : missing;
    }
    const items = talent.filter(
      (item) =>
        has(query.get("q"), item.name, item.headline, ...item.skills) &&
        (!query.get("role") || item.roles.includes(query.get("role"))) &&
        (!query.get("country") || item.country === query.get("country")) &&
        (!query.get("engagement") || item.engagement.includes(query.get("engagement"))),
    );
    return [200, page(url, items.map(personSummaryOf))];
  }
  return undefined;
}
