// What the stub backend holds of the public directories: approved solutions with the organizations
// behind them and their customer deployments, and approved talent profiles. Anyone reads these.

const pocketPolicy = {
  slug: "pocket-policy",
  name: "Pocket Policy",
  type: "company",
  country: "SG",
  description: "Assistants for insurers across Southeast Asia.",
  website: "https://www.pocketpolicy.example/",
};
const lumenHealth = {
  slug: "lumen-health",
  name: "Lumen Health",
  type: "builder_team",
  country: "VN",
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
    website: "https://pocketpolicy.example",
    focusAreas: ["conversational_ai"],
    industries: ["insurance"],
    deployment: ["cloud_saas"],
    maturity: "pilot",
    ...more,
  };
}

/** The approved solutions, the most recently approved first. */
const solutions = [
  solution(pocketPolicy, "Policy Chat", { maturity: "production" }),
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
    availability: "available",
    engagement: ["contract", "advisory"],
    rateBand: "50_100",
    projects: [{ title: "Claims assistant for an insurer", year: 2025, summary: null, url: null }],
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
    availability: "open_to_offers",
    projects: [],
    rateBand: undefined,
    website: null,
  }),
  // The operator of these tests has a profile of their own.
  person("Đạt Phan", { slug: "dat-phan", roles: ["ai_consultant"], skills: ["Strategy"] }),
];

const personSummaryOf = (item) =>
  only(item, "slug", "name", "headline", "country", "roles", "skills", "availability");

const has = (text, ...fields) =>
  !text || fields.some((field) => (field ?? "").toLowerCase().includes(text.toLowerCase()));

function page(url, items) {
  const sorted =
    url.searchParams.get("sort") === "name"
      ? items.toSorted((one, other) => one.name.localeCompare(other.name))
      : items;
  return { items: sorted, page: 1, pageSize: 25, total: sorted.length };
}

const missing = [404, { status: 404, code: "NOT_FOUND" }];

/** The answer to a read of the public directories, as `[status, body]`; nothing for another path. */
export function answerDirectory(url) {
  const { pathname, searchParams: query } = url;
  const [, area, list, slug] = /^\/api\/(\w+)\/(\w+)(?:\/([^/]+))?$/.exec(pathname) ?? [];

  if (area === "solution" && list === "solutions") {
    if (slug) {
      const found = solutions.find((item) => item.slug === slug);
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
        (!query.get("availability") || item.availability === query.get("availability")),
    );
    return [200, page(url, items.map(personSummaryOf))];
  }
  return undefined;
}
