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
  logoFileId: "0b6f2f0e-5d0e-4c57-9a55-6f6f3c1d2a10",
};
const lumenHealth = {
  slug: "lumen-health",
  name: "Lumen Health",
  type: "builder_team",
  country: "VN",
  industries: [],
  description: null,
  website: null,
  logoFileId: null,
};
const organizations = [pocketPolicy, lumenHealth];

// The offers GenAI Fund keeps. Policy Chat comes with one, so the gift on its card is the link itself;
// Clinic Triage comes with two, so the gift opens their list.
const cloudCredits = {
  id: "0ffe7a11-0000-4000-8000-000000000001",
  title: "$1,000 in cloud credits",
  url: "https://offers.example/cloud-credits",
  fromGenAiFund: true,
};
const supportHours = {
  id: "0ffe7a11-0000-4000-8000-000000000002",
  title: "Ten hours of onboarding support",
  url: "https://offers.example/onboarding",
  // Written by the organization of the solution, so it carries no mark of GenAI Fund.
  fromGenAiFund: false,
};
export const offers = [cloudCredits, supportHours];
const offersBySlug = {
  "policy-chat": [cloudCredits],
  "clinic-triage": [cloudCredits, supportHours],
};
/** The offers a solution comes with as the public reads them: what each is called and where it is claimed. */
const offersOf = (slug) =>
  (offersBySlug[slug] ?? []).map(({ title, url, fromGenAiFund }) => ({
    title,
    url,
    fromGenAiFund,
  }));

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
    organizationFoundedYear: null,
    organizationTeamSize: null,
    organizationCompanySizeLabel: null,
    productNames: [],
    coreTechnology: null,
    infrastructureUsed: null,
    segmentFocus: [],
    notablePayingCustomers: null,
    useCaseIndustries: [],
    useCaseDescriptions: null,
    monetizationModel: null,
    companyFundingStatus: null,
    companyFundingRaised: null,
    competitors: null,
    traction: null,
    builtWith: [],
    languages: [],
    bestCustomerProfile: null,
    website: "https://pocketpolicy.example",
    demoUrl: null,
    deck: null,
    logoFileId: null,
    coverFileId: null,
    imageFileIds: [],
    listed: true,
    approved: true,
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
    logoFileId: "1090a2b3-4c5d-4e6f-8a9b-0c1d2e3f4a01",
    coverFileId: "c0fea2b3-4c5d-4e6f-8a9b-0c1d2e3f4a02",
    imageFileIds: ["1a9ea2b3-4c5d-4e6f-8a9b-0c1d2e3f4a03", "1a9ea2b3-4c5d-4e6f-8a9b-0c1d2e3f4a04"],
    languages: ["vi", "en"],
    builtWith: ["Python", "PostgreSQL"],
    bestCustomerProfile: "Insurers with a call centre of fifty seats or more.",
    organizationFoundedYear: 2018,
    organizationCompanySizeLabel: "20–99 employees",
    traction: "Three production pilots across banking.",
    productNames: ["Policy Voice"],
    coreTechnology: "A voice agent with retrieval over policy documents.",
    infrastructureUsed: "AWS and Google Cloud",
    segmentFocus: ["B2B", "B2B2C"],
    notablePayingCustomers: "Mekong Life, Lotus Bank",
    useCaseIndustries: ["Insurance"],
    useCaseDescriptions:
      "Claims intake: voice and chat for policyholders.\nRenewals: identify missing documents.",
    monetizationModel: "Subscription (SaaS)",
    companyFundingStatus: "Bootstrapped",
    companyFundingRaised: "USD 500,000",
    competitors: "ClaimLens, Manual claim queues",
  }),
  solution(lumenHealth, "Clinic Triage", {
    summary: "Triage for clinics before the first visit.",
    problemsSolved: null,
    valueProposition: null,
    industries: [],
    maturity: null,
    deployment: [],
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
  // GenAI Fund features one solution; the stub orders nothing by it.
  featured: item.slug === "policy-chat",
  offers: offersOf(item.slug),
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
  // GenAI Fund features one profile; the stub orders nothing by it.
  featured: item.slug === "arif-hidayat",
});

const has = (text, ...fields) =>
  !text || fields.some((field) => (field ?? "").toLowerCase().includes(text.toLowerCase()));

function page(url, items) {
  const sorted =
    url.searchParams.get("sort") === "name"
      ? items.toSorted((one, other) => one.name.localeCompare(other.name))
      : items;
  const pageNumber = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(
    url.searchParams.get("size") ?? (url.pathname.endsWith("/deployments") ? "25" : "12"),
  );
  return {
    items: sorted.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    page: pageNumber,
    pageSize,
    total: sorted.length,
  };
}

/** The published use cases, the most recently published first; the third is anonymous and its budget is hidden. */
const useCases = [
  {
    id: "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0001",
    title: "Voice assistant for vehicle owners",
    organizationName: "Pocket Policy",
    organizationLogoFileId: pocketPolicy.logoFileId,
    industry: "automotive_mobility",
    goal: "Cut hotline calls by 40%.",
    technologies: ["voice_ai", "conversational_ai"],
    budgetMin: 15000,
    budgetMax: 40000,
    currency: "USD",
    budgetToBeDetermined: false,
    budgetMembersOnly: false,
    timelineMinWeeks: 8,
    timelineMaxWeeks: 12,
    closesAt: "2026-12-31T16:59:00Z",
    publishedAt: "2026-10-02T02:00:00Z",
    // GenAI Fund features this one; the stub orders nothing by it.
    featured: true,
  },
  {
    id: "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0002",
    title: "Claims triage with document intelligence",
    organizationName: "Lumen Health",
    organizationLogoFileId: lumenHealth.logoFileId,
    industry: "insurance",
    goal: "Route claims to the right team on arrival.",
    technologies: ["document_intelligence"],
    budgetMin: null,
    budgetMax: null,
    currency: "USD",
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
    organizationLogoFileId: null,
    industry: "retail_ecommerce",
    goal: "Forecast weekly demand per store.",
    technologies: ["predictive_analytics", "anomaly_detection", "recommendation"],
    budgetMin: null,
    budgetMax: null,
    currency: "USD",
    budgetToBeDetermined: false,
    budgetMembersOnly: true,
    timelineMinWeeks: 12,
    timelineMaxWeeks: 16,
    closesAt: "2026-12-01T16:59:00Z",
    publishedAt: "2026-09-30T02:00:00Z",
  },
];

const useCaseDetails = useCases.map((item) => ({
  ...item,
  problemStatement: `${item.goal} The team needs a clear, measurable way to improve this work.`,
  expectedOutcomes: "Improve the outcome, reduce manual effort and make progress measurable.",
  currentProcess: "The team coordinates this work manually across separate systems.",
  currentSolutions: "The current tools do not solve the full problem.",
  targetUsers: "The operating team and the people it serves.",
  dataReadiness: "Relevant operational data is available and refreshed regularly.",
  integrationRequirements: "The solution must work with the organization's existing systems.",
}));

/** The public list of use cases: the search looks in the title, the goal and the organization's name. */
function pageOfUseCases(url) {
  const { searchParams: query } = url;
  const sort = query.get("sort") ?? "newest";
  const industries = query
    .getAll("industry")
    .flatMap((industry) => industry.split(","))
    .filter(Boolean);
  const program = query.get("program");
  const items = useCases
    .filter(
      (item) =>
        (!program || (programUseCases[program] ?? []).includes(item.title)) &&
        has(query.get("q"), item.title, item.goal, item.organizationName) &&
        (industries.length === 0 || industries.includes(item.industry)),
    )
    .toSorted((one, other) =>
      sort === "deadline"
        ? one.closesAt.localeCompare(other.closesAt)
        : sort === "budget"
          ? (other.budgetMax ?? 0) - (one.budgetMax ?? 0)
          : other.publishedAt.localeCompare(one.publishedAt),
    );
  const pageNumber = Number(query.get("page") ?? "1");
  const pageSize = Number(query.get("size") ?? "10");
  return {
    items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    page: pageNumber,
    pageSize,
    total: items.length,
  };
}

/** The use cases an operator attached to a program, by the program's address. */
const programUseCases = {
  "insurance-ai-tasco": [
    "Voice assistant for vehicle owners",
    "Claims triage with document intelligence",
  ],
};

const missing = [404, { status: 404, code: "NOT_FOUND" }];

/** The answer to a read of the public directories, as `[status, body]`; nothing for another path. */
export function answerDirectory(url) {
  const { pathname, searchParams: query } = url;
  if (pathname === "/api/usecase/use-cases") {
    return [200, pageOfUseCases(url)];
  }
  const useCaseId = /^\/api\/usecase\/use-cases\/([^/]+)$/.exec(pathname)?.[1];
  if (useCaseId) {
    const found = useCaseDetails.find((item) => item.id === useCaseId);
    return found ? [200, found] : missing;
  }
  const [, area, list, slug] = /^\/api\/(\w+)\/(\w+)(?:\/([^/]+))?$/.exec(pathname) ?? [];
  if (area === "solution" && list === "solutions") {
    if (slug) {
      const found = [...solutions, unlisted].find((item) => item.slug === slug);
      return found
        ? [200, { ...found, customerDeployments: deploymentsOf(slug), offers: offersOf(slug) }]
        : missing;
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
        (!query.get("role") || item.roles.includes(query.get("role"))),
    );
    return [200, page(url, items.map(personSummaryOf))];
  }
  return undefined;
}

/** Directory-search fixtures keep the public card fields when the page reads the shared search API. */
export function directorySearchItems(url) {
  const kind = url.searchParams.get("kind");
  const listPath = {
    solution: "/api/solution/solutions",
    talent: "/api/talent/profiles",
    use_case: "/api/usecase/use-cases",
  }[kind];
  if (!listPath) {
    return null;
  }
  const directory = new URL(url);
  directory.pathname = listPath;
  directory.searchParams.delete("page");
  directory.searchParams.set("size", "100");
  const [, response] = answerDirectory(directory);
  return response.items.map((record) => ({
    kind,
    slug: record.slug ?? record.id,
    title: record.name ?? record.title,
    subtitle: record.organizationName ?? record.headline ?? null,
    summary: record.summary ?? record.goal ?? record.headline ?? "",
    snippet: record.summary ?? record.goal ?? record.headline ?? "",
    organizationSlug: record.organizationSlug ?? null,
    organizationLogoFileId: record.organizationLogoFileId ?? null,
    country: record.country ?? null,
    maturity: record.maturity ?? null,
    customerDeployments: record.customerDeployments ?? null,
    industries: record.industries ?? (record.industry ? [record.industry] : []),
    focusAreas: record.focusAreas ?? [],
    roles: record.roles ?? [],
    skills: record.skills ?? [],
    city: record.city ?? null,
    photoFileId: record.photoFileId ?? null,
    featured: record.featured ?? false,
    offers: record.offers ?? [],
    coverFileId: solutions.find((entry) => entry.slug === record.slug)?.coverFileId ?? null,
    backing: null,
    projectCount: record.projectCount ?? null,
    leadProjectTitle: record.leadProject?.title ?? null,
    leadProjectStage: record.leadProject?.stage ?? null,
    budgetMin: record.budgetMin ?? null,
    budgetMax: record.budgetMax ?? null,
    budgetToBeDetermined: record.budgetToBeDetermined ?? null,
    budgetMembersOnly: record.budgetMembersOnly ?? null,
    currency: record.currency ?? null,
    closesAt: record.closesAt ?? null,
    publishedAt: record.publishedAt ?? null,
    technologies: record.technologies ?? [],
    timelineMinWeeks: record.timelineMinWeeks ?? null,
    timelineMaxWeeks: record.timelineMaxWeeks ?? null,
  }));
}
