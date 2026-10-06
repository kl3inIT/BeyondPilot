// What the stub backend holds of the three records GenAI Fund reviews: organizations, solutions and
// talent profiles, as the operators' lists and their record pages read them. Nothing here changes: a
// decision is answered by the test that makes it, and the page reads the same records again.

const hour = 60 * 60 * 1000;
const ago = (hours) => new Date(Date.now() - hours * hour).toISOString();
const day = "2026-10-01T03:00:00Z";

function organization(id, name, status, more) {
  return {
    id,
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    status,
    type: "company",
    roles: ["provider"],
    country: "VN",
    teamSize: "10_49",
    industries: ["insurance"],
    website: `https://${name.toLowerCase().replaceAll(" ", "")}.example`,
    emailDomain: null,
    description: null,
    autoJoin: false,
    version: 0,
    createdAt: day,
    ...more,
  };
}

const person = (accountId, name, email, role) => ({
  accountId,
  name,
  email,
  role,
  jobTitle: null,
  joinedAt: day,
  self: false,
});

/** Every organization as an operator's record page reads it, those waiting for review first. */
const organizations = [
  {
    organization: organization("8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c01", "Lumen Health", "pending", {
      description: "Triage assistants for clinics.",
    }),
    createdBy: "Linh Nguyễn",
    createdByEmail: "linh.nguyen@lumenhealth.example",
    members: [
      person(
        "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a11",
        "Linh Nguyễn",
        "linh.nguyen@lumenhealth.example",
        "owner",
      ),
    ],
    invitations: [],
    claims: [],
  },
  {
    organization: organization("8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c02", "Open Kitchen", "approved", {
      type: "builder_team",
      roles: ["enterprise"],
    }),
    createdBy: "Đạt Phan",
    createdByEmail: "dat.phan@example.com",
    members: [],
    invitations: [],
    claims: [
      {
        id: "9c4f6d85-3c31-4d86-8d88-3a6c9c9e0d01",
        claim: true,
        name: "Arif Hidayat",
        email: "arif@openkitchen.example",
        message: "I founded the team.",
        organizationId: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c02",
        organizationName: "Open Kitchen",
        createdAt: day,
      },
    ],
  },
  {
    organization: organization(
      "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
      "Pocket Policy",
      "approved",
      {
        country: "SG",
      },
    ),
    createdBy: "Minh Trần",
    createdByEmail: "minh.tran@pocketpolicy.example",
    members: [
      person(
        "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a04",
        "Minh Trần",
        "minh.tran@pocketpolicy.example",
        "owner",
      ),
      person(
        "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a12",
        "Siti Rahma",
        "siti@pocketpolicy.example",
        "member",
      ),
    ],
    invitations: [],
    claims: [],
  },
  {
    organization: organization("8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c04", "Firstcall", "rejected", {
      decisionReason: "incomplete",
      decisionMessage: "Say what the company builds.",
    }),
    createdBy: "Quang Vũ",
    createdByEmail: "quang.vu@firstcall.example",
    members: [
      person(
        "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a05",
        "Quang Vũ",
        "quang.vu@firstcall.example",
        "owner",
      ),
    ],
    invitations: [],
    claims: [],
  },
];

function deployment(id, title, status, more) {
  return {
    id,
    title,
    status,
    customer: "A regional insurer",
    stage: "production",
    problem: "Claims waited days for a first answer.",
    delivered: "A chat assistant on the claims line.",
    channels: null,
    languages: null,
    period: null,
    result: null,
    version: 0,
    updatedAt: day,
    ...more,
  };
}

function solution(id, name, status, more) {
  return {
    id,
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    status,
    organizationId: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
    organizationName: "Pocket Policy",
    submittedBy: "Đạt Phan",
    summary: `${name} for insurers.`,
    problemsSolved: "Slow answers to policy holders.",
    valueProposition: "An answer in seconds, in Vietnamese and English.",
    traction: null,
    builtWith: [],
    languages: [],
    bestCustomerProfile: null,
    website: "https://pocketpolicy.example",
    demoUrl: null,
    deck: null,
    focusAreas: ["conversational_ai"],
    industries: ["insurance"],
    deployment: ["cloud_saas"],
    maturity: "pilot",
    listed: true,
    complete: true,
    customerDeployments: [],
    submittedAt: day,
    updatedAt: day,
    version: 1,
    ...more,
  };
}

/** Every submitted solution, those waiting for a decision first and the longest wait on top. */
const solutions = [
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e01", "Claims Copilot", "submitted", {
    submittedAt: ago(3),
  }),
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e02", "Underwriting Radar", "submitted", {
    submittedAt: ago(1),
    maturity: "prototype",
  }),
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e03", "Policy Chat", "approved", {
    maturity: "production",
    customerDeployments: [
      deployment("be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f01", "Claims line at Bảo An", "submitted"),
      deployment("be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f02", "Renewals at Mekong Life", "approved", {
        stage: "pilot",
        result: "Half of renewals answered without an agent.",
      }),
    ],
  }),
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e04", "Quote Bot", "rejected", {
    decisionReason: "duplicate",
    decisionMessage: "It is Policy Chat under another name.",
  }),
];

function profile(id, name, status, more) {
  return {
    id,
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    status,
    headline: "Forward deployed engineer",
    bio: "Ships assistants into call centres.",
    country: "VN",
    website: null,
    roles: ["forward_deployed_engineer"],
    skills: ["Python", "RAG"],
    engagement: ["contract"],
    rateBand: "50_100",
    projects: [{ title: "Claims assistant", year: 2025, summary: null, url: null }],
    listed: true,
    complete: true,
    submittedAt: day,
    updatedAt: day,
    version: 1,
    languages: [],
    industries: [],
    ...more,
  };
}

/** Every submitted talent profile with its account's address, those waiting for a decision first. */
const talent = [
  {
    email: "bao.tran@example.com",
    profile: profile("cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a01", "Bảo Trần", "submitted", {
      submittedAt: ago(5),
    }),
  },
  {
    email: "mai.pham@example.com",
    profile: profile("cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a02", "Mai Phạm", "submitted", {
      submittedAt: ago(2),
      headline: "AI product manager",
      roles: ["ai_product_manager"],
    }),
  },
  {
    email: "arif@openkitchen.example",
    profile: profile("cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a03", "Arif Hidayat", "approved", {
      headline: "ML engineer",
      roles: ["ml_engineer"],
      country: "ID",
    }),
  },
  {
    email: "siti@pocketpolicy.example",
    profile: profile("cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a04", "Siti Rahma", "changes_requested", {
      decisionReason: "incomplete",
      decisionMessage: "Add a project.",
    }),
  },
];

/** One page of a list, narrowed as the operators' lists narrow: by text and by status. */
function page(url, records, statusOf, textOf, summaryOf) {
  const text = (url.searchParams.get("q") ?? "").toLowerCase();
  const status = url.searchParams.get("status");
  const items = records.filter(
    (record) =>
      (!status || statusOf(record) === status) &&
      (!text || textOf(record).toLowerCase().includes(text)),
  );
  return { items: items.map(summaryOf), page: 1, pageSize: 25, total: items.length };
}

/** The requests for an introduction, as the operators' list reads them: no address anywhere. */
const introductions = [
  {
    id: "e19ebcda-8b86-4cd9-9cd3-8f1b4b4d5c31",
    solutionName: "Policy Chat",
    providerOrganization: "Pocket Policy",
    senderOrganization: "Lumen Health",
    senderName: "Hà Lê",
    message: "We want a renewals assistant for our clinics. Can you run it in Vietnamese?",
    status: "pending",
    overdue: true,
    createdAt: ago(100),
    answeredAt: null,
  },
  {
    id: "e19ebcda-8b86-4cd9-9cd3-8f1b4b4d5c32",
    solutionName: "Claims Vision",
    providerOrganization: "Pocket Policy",
    senderOrganization: "Mekong Life",
    senderName: null,
    message: "Can it read our scanned claim forms?",
    status: "pending",
    overdue: false,
    createdAt: ago(5),
    answeredAt: null,
  },
  {
    id: "e19ebcda-8b86-4cd9-9cd3-8f1b4b4d5c33",
    solutionName: "Agent Coach",
    providerOrganization: "Pocket Policy",
    senderOrganization: "Bảo An",
    senderName: "Quang Vũ",
    message: "Do you coach agents in Vietnamese?",
    status: "replied",
    overdue: false,
    createdAt: day,
    answeredAt: day,
  },
];

/** The messages people reported through their talent profiles. */
const reportedEnquiries = [
  {
    id: "7c1d7f0e-2b9a-4f3e-9d52-6a1f0b3c2e91",
    profileName: "Siti Rahma",
    senderName: null,
    senderEmail: "growth@spam.example",
    topic: "other",
    message: "Buy ten thousand followers for your profile.",
    createdAt: "2026-10-03T03:00:00Z",
    reportedAt: "2026-10-04T03:00:00Z",
  },
];

const lists = {
  "/api/introduction/admin/introductions": {
    records: introductions,
    idOf: (record) => record.id,
    statusOf: (record) => record.status,
    textOf: (record) => record.solutionName,
    summaryOf: (record) => record,
  },
  "/api/organization/admin/organizations": {
    records: organizations,
    idOf: (record) => record.organization.id,
    statusOf: (record) => record.organization.status,
    textOf: (record) => record.organization.name,
    summaryOf: ({ organization: { id, name, slug, status, type, roles, country }, ...record }) => ({
      id,
      name,
      slug,
      status,
      type,
      roles,
      country,
      createdAt: day,
      members: record.members.length,
      owned: record.members.some((member) => member.role === "owner"),
      openClaims: record.claims.length,
    }),
  },
  "/api/solution/admin/solutions": {
    records: solutions,
    idOf: (record) => record.id,
    statusOf: (record) => record.status,
    textOf: (record) => `${record.name} ${record.organizationName}`,
    summaryOf: ({ id, name, slug, status, organizationName, summary, maturity, ...record }) => ({
      id,
      name,
      slug,
      status,
      organizationName,
      summary,
      maturity,
      industries: record.industries,
      listed: record.listed,
      submittedAt: record.submittedAt,
      submittedBy: record.submittedBy,
      updatedAt: record.updatedAt,
      deploymentsAwaitingReview: record.customerDeployments.filter(
        (item) => item.status === "submitted",
      ).length,
    }),
  },
  "/api/talent/admin/reported-enquiries": {
    records: reportedEnquiries,
    idOf: (record) => record.id,
    statusOf: () => "reported",
    textOf: (record) => record.message,
    summaryOf: (record) => record,
  },
  "/api/talent/admin/profiles": {
    records: talent,
    idOf: (record) => record.profile.id,
    statusOf: (record) => record.profile.status,
    textOf: (record) => `${record.profile.name} ${record.email}`,
    summaryOf: ({ email, profile: { id, name, slug, status, headline, ...record } }) => ({
      id,
      name,
      slug,
      status,
      headline,
      email,
      listed: record.listed,
      submittedAt: record.submittedAt,
      updatedAt: record.updatedAt,
    }),
  },
};

/**
 * The answer to an operator's read of a review list or of one of its records, as `[status, body]`;
 * nothing when the path is neither.
 */
export function answerReview(url, account) {
  const path = Object.keys(lists).find(
    (candidate) => url.pathname === candidate || url.pathname.startsWith(`${candidate}/`),
  );
  if (!path) {
    return undefined;
  }
  if (account?.role !== "operator") {
    return [account ? 403 : 401, {}];
  }
  const { records, idOf, statusOf, textOf, summaryOf } = lists[path];
  if (url.pathname === path) {
    const found = page(url, records, statusOf, textOf, summaryOf);
    return [
      200,
      path === "/api/introduction/admin/introductions"
        ? { ...found, overdue: records.filter((record) => record.overdue).length }
        : path === "/api/solution/admin/solutions"
          ? {
              ...found,
              awaitingReview: records.filter((record) => record.status === "submitted").length,
            }
          : found,
    ];
  }
  const record = records.find(
    (candidate) => idOf(candidate) === url.pathname.slice(path.length + 1),
  );
  return record ? [200, record] : [404, { status: 404, code: "NOT_FOUND" }];
}
