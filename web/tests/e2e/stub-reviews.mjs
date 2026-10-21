// What the stub backend holds of the three records GenAI Fund reviews: organizations, solutions and
// talent profiles, as the operators' lists and their record pages read them. Nothing here changes: a
// decision is answered by the test that makes it, and the page reads the same records again.

import { offers } from "./stub-directories.mjs";

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

/** Every organization as an operator's record page reads it. */
const organizations = [
  {
    // A duplicate merged into Pocket Policy: it only says where it went.
    organization: organization(
      "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c08",
      "Pocket Policy Ltd",
      "merged",
    ),
    createdBy: "Minh Trần",
    createdByEmail: "minh.tran@pocketpolicy.example",
    members: [],
    invitations: [],
    claims: [],
    merged: {
      intoId: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
      intoSlug: "pocket-policy",
      intoName: "Pocket Policy",
      mergedAt: "2026-10-07T03:00:00Z",
      mergedBy: "Young Xv",
    },
  },
  {
    organization: organization("8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c01", "Lumen Health", "active", {
      description: "Triage assistants for clinics.",
    }),
    createdBy: "Linh Nguyễn",
    createdByEmail: "linh.nguyen@lumenhealth.example",
    suggestedDomain: "lumenhealth.example",
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
    organization: organization("8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c02", "Open Kitchen", "active", {
      type: "builder_team",
    }),
    createdBy: "Đạt Phan",
    createdByEmail: "dat.phan@example.com",
    suggestedDomain: "openkitchen.example",
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
        organizationType: "builder_team",
        organizationCountry: "VN",
        organizationDomain: null,
        createdAt: day,
      },
    ],
  },
  {
    organization: organization(
      "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
      "Pocket Policy",
      "active",
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
    // Nobody owns it, and one person asks to.
    organization: organization("8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c04", "Firstcall", "active"),
    createdBy: "Quang Vũ",
    createdByEmail: "quang.vu@firstcall.example",
    members: [],
    invitations: [],
    claims: [
      {
        id: "9c4f6d85-3c31-4d86-8d88-3a6c9c9e0d02",
        name: "Quang Vũ",
        email: "quang.vu@firstcall.example",
        message: "I run Firstcall.",
        createdAt: day,
      },
    ],
  },
  {
    organization: organization("8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c06", "Quiet Mill", "active", {
      suspensionReason: "misleading_information",
      suspensionMessage: "Send us the contract or remove the customer.",
      suspendedAt: "2026-10-06T03:00:00Z",
    }),
    createdBy: "Hana Lê",
    createdByEmail: "hana.le@quietmill.example",
    members: [
      person(
        "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a21",
        "Hana Lê",
        "hana.le@quietmill.example",
        "owner",
      ),
    ],
    invitations: [],
    claims: [],
  },
  {
    // Twelve people and an open invitation: the Members tab pages ten at a time.
    organization: organization(
      "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c07",
      "Harbor Bank",
      "active",
      {},
    ),
    createdBy: "Bao Tran",
    createdByEmail: "bao.tran@harborbank.example",
    members: Array.from({ length: 12 }, (_, index) =>
      person(
        `6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a${String(30 + index)}`,
        `Teller ${String(index + 1).padStart(2, "0")}`,
        `teller${index + 1}@harborbank.example`,
        index === 0 ? "owner" : "member",
      ),
    ),
    invitations: [
      {
        id: "7d5a7e96-4d42-4e97-9e99-4b7dad0f1e01",
        email: "newhire@harborbank.example",
        role: "member",
        createdAt: day,
        expiresAt: "2026-10-08T03:00:00Z",
      },
    ],
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
    logo: {
      fileId: `1090a2b3-4c5d-4e6f-8a9b-${id.slice(-12)}`,
      fileName: "logo.png",
      sizeBytes: 86016,
    },
    cover: {
      fileId: `c0fea2b3-4c5d-4e6f-8a9b-${id.slice(-12)}`,
      fileName: "cover.png",
      sizeBytes: 1258291,
    },
    images: [],
    offers: [],
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
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e01", "Claims Copilot", "in_review", {
    submittedAt: ago(3),
  }),
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e02", "Underwriting Radar", "in_review", {
    submittedAt: ago(1),
    maturity: "prototype",
  }),
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e03", "Policy Chat", "approved", {
    maturity: "production",
    // An operator featured it.
    featuredAt: day,
    customerDeployments: [
      deployment("be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f01", "Claims line at Bảo An", "in_review"),
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
  // Approved, then taken down: it stays approved with the day it went down.
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e05", "Risk Lens", "approved", {
    suspendedAt: ago(48),
    suspensionReason: "misleading_information",
    suspensionMessage: "The customers named are not real.",
  }),
];

/** A draft an operator started for an organization: complete, so the editor's last step can publish it. */
const operatorDraft = solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e06", "Draft Desk", "draft", {
  submittedAt: null,
  submittedBy: null,
});

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
    profile: profile("cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a01", "Bảo Trần", "in_review", {
      submittedAt: ago(5),
    }),
  },
  {
    email: "mai.pham@example.com",
    profile: profile("cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a02", "Mai Phạm", "in_review", {
      submittedAt: ago(2),
      headline: "AI product manager",
      roles: ["ai_product_manager"],
    }),
  },
  {
    email: "arif@openkitchen.example",
    // An operator featured it.
    featuredAt: day,
    profile: profile("cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a03", "Arif Hidayat", "approved", {
      headline: "ML engineer",
      roles: ["ml_engineer"],
      country: "ID",
    }),
  },
  {
    email: "siti@pocketpolicy.example",
    profile: profile("cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a04", "Siti Rahma", "needs_changes", {
      decisionReason: "incomplete",
      decisionMessage: "Add a project.",
    }),
  },
  {
    email: "dewi@example.com",
    profile: profile("cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a05", "Dewi Lestari", "approved", {
      suspendedAt: ago(30),
      suspensionReason: "inappropriate",
      suspensionMessage: "Remove the client logos.",
    }),
  },
];

/**
 * One page of a list, narrowed as the operators' lists narrow: by text, status, featured and, where
 * the records have one, country. It holds as many items as the address asks for.
 */
function page(url, records, statusOf, textOf, summaryOf, countryOf) {
  const text = (url.searchParams.get("q") ?? "").toLowerCase();
  const status = url.searchParams.get("status");
  const country = url.searchParams.get("country");
  const organizationId = url.searchParams.get("organizationId");
  const featured = url.searchParams.get("featured");
  const size = Number(url.searchParams.get("size")) || 25;
  const number = Number(url.searchParams.get("page")) || 1;
  const items = records.filter(
    // A merged record is listed only when merged ones are asked for, as the backend lists it.
    (record) =>
      (status ? statusOf(record) === status : statusOf(record) !== "merged") &&
      (!organizationId || record.organizationId === organizationId) &&
      (!text || textOf(record).toLowerCase().includes(text)) &&
      (!country || countryOf?.(record) === country) &&
      (featured === null || Boolean(record.featuredAt) === (featured === "true")),
  );
  return {
    items: items.slice((number - 1) * size, number * size).map(summaryOf),
    page: number,
    pageSize: size,
    total: items.length,
    ...(countryOf && { countries: [...new Set(records.map(countryOf).filter(Boolean))].sort() }),
  };
}

const lists = {
  "/api/organization/admin/organizations": {
    // Those with an open claim come first, as the backend lists them.
    records: organizations.toSorted(
      (a, b) => Number(b.claims.length > 0) - Number(a.claims.length > 0),
    ),
    idOf: (record) => record.organization.id,
    countryOf: (record) => record.organization.country,
    // An open claim is filtered as `claimed` and one taken down as `suspended`, not as active.
    statusOf: (record) =>
      record.claims.length > 0
        ? "claimed"
        : record.organization.suspendedAt
          ? "suspended"
          : record.organization.status,
    textOf: (record) => record.organization.name,
    summaryOf: ({
      organization: { id, name, slug, status, type, country, suspendedAt = null },
      ...record
    }) => ({
      id,
      name,
      slug,
      status,
      suspendedAt,
      type,
      country,
      createdAt: day,
      members: record.members.length,
      owned: record.members.some((member) => member.role === "owner"),
      request: record.claims.length > 0 ? "claim" : null,
      claimId: record.claims[0]?.id ?? null,
      askedBy: record.claims[0]?.name ?? null,
      requestedAt: record.claims.length > 0 ? day : null,
      mergedInto: record.merged?.intoName ?? null,
    }),
  },
  "/api/solution/admin/solutions": {
    records: solutions,
    idOf: (record) => record.id,
    // A solution taken down is approved with the date it went down, and filters as `suspended`.
    statusOf: (record) => (record.suspendedAt ? "suspended" : record.status),
    textOf: (record) => `${record.name} ${record.organizationName}`,
    summaryOf: ({ id, name, slug, status, organizationName, summary, maturity, ...record }) => ({
      id,
      name,
      slug,
      status,
      suspendedAt: record.suspendedAt ?? null,
      featuredAt: record.featuredAt ?? null,
      organizationName,
      summary,
      maturity,
      industries: record.industries,
      listed: record.listed,
      submittedAt: record.submittedAt,
      submittedBy: record.submittedBy,
      updatedAt: record.updatedAt,
      deploymentsAwaitingReview: record.customerDeployments.filter(
        (item) => item.status === "in_review",
      ).length,
    }),
  },
  "/api/talent/admin/profiles": {
    records: talent,
    idOf: (record) => record.profile.id,
    // A profile taken down is approved with the date it went down, and filters as `suspended`.
    statusOf: (record) => (record.profile.suspendedAt ? "suspended" : record.profile.status),
    textOf: (record) => `${record.profile.name} ${record.email}`,
    summaryOf: ({
      email,
      featuredAt = null,
      profile: { id, name, slug, status, headline, suspendedAt = null, ...record },
    }) => ({
      id,
      name,
      slug,
      status,
      suspendedAt,
      featuredAt,
      headline,
      email,
      listed: record.listed,
      submittedAt: record.submittedAt,
      updatedAt: record.updatedAt,
    }),
  },
};

/** How many records of each kind wait now, as the admin home reads each queue. */
const queues = {
  "/api/usecase/admin/use-cases/queue": () => 0,
  "/api/solution/admin/solutions/queue": () =>
    solutions.filter((record) => record.status === "in_review").length,
  "/api/solution/admin/deployments/queue": () =>
    solutions
      .flatMap((record) => record.customerDeployments)
      .filter((item) => item.status === "in_review").length,
  "/api/talent/admin/profiles/queue": () =>
    talent.filter((record) => record.profile.status === "in_review").length,
  "/api/organization/admin/organizations/queue": () =>
    organizations.filter((record) => record.claims.length > 0).length,
};

/** A queue that grew to what waits now: one fewer until four days ago. The oldest was sent 3 days ago. */
function queueOf(waiting) {
  const today = new Date();
  // The first of the days in Vietnam, as the backend counts them; "en-CA" writes a day as 2026-10-07.
  const from = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(today.getTime() - 13 * 86_400_000),
  );
  return {
    waiting,
    oldestSince: waiting > 0 ? new Date(today.getTime() - 3 * 86_400_000).toISOString() : null,
    from,
    days: Array.from({ length: 14 }, (_, day) => (day < 10 ? Math.max(0, waiting - 1) : waiting)),
  };
}

/**
 * The answer to an operator's read of a review list or of one of its records, as `[status, body]`;
 * nothing when the path is neither.
 */
export function answerReview(url, account) {
  // Every organization's offers, which an operator reads. The picker reads its own from the browser,
  // which a test answers. Both are Pocket Policy's: GenAI Fund arranged the first, the second it wrote.
  const listed = offers.map((offer, index) => ({
    ...offer,
    organizationId: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
    organizationName: "Pocket Policy",
    // The first goes with a solution, so it cannot be deleted; the second with none.
    solutions: index === 0 ? 1 : 0,
    version: 0,
    updatedAt: day,
    closed: false,
  }));
  if (url.pathname === "/api/solution/admin/offers") {
    if (account?.role !== "operator") {
      return [account ? 403 : 401, {}];
    }
    return [200, listed];
  }
  // The record of one offer: the offer and the solutions that come with it.
  const offerRecord = url.pathname.match(/^\/api\/solution\/admin\/offers\/([^/]+)$/);
  if (offerRecord) {
    if (account?.role !== "operator") {
      return [account ? 403 : 401, {}];
    }
    const offer = listed.find((item) => item.id === offerRecord[1]);
    if (!offer) {
      return [404, { status: 404, code: "SOLUTION_OFFER_NOT_FOUND" }];
    }
    return [
      200,
      {
        offer,
        createdAt: day,
        solutionList: [
          {
            id: "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e03",
            slug: "policy-chat",
            name: "Policy Chat",
            organizationId: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
            organizationName: "Pocket Policy",
            status: "approved",
            suspendedAt: null,
          },
        ],
      },
    ];
  }
  // The editor of an operator reads a draft, which no list of submitted solutions holds, and the organizations.
  const draft = url.pathname.match(/^\/api\/solution\/admin\/solutions\/([^/]+)\/draft$/);
  const organizations = url.pathname === "/api/solution/admin/solutions/organizations";
  if (draft || organizations) {
    if (account?.role !== "operator") {
      return [account ? 403 : 401, {}];
    }
    if (organizations) {
      return [200, [{ id: operatorDraft.organizationId, name: operatorDraft.organizationName }]];
    }
    return draft[1] === operatorDraft.id
      ? [200, operatorDraft]
      : [404, { status: 404, code: "SOLUTION_NOT_FOUND" }];
  }
  const queue = queues[url.pathname];
  if (queue) {
    return account?.role === "operator" ? [200, queueOf(queue())] : [account ? 403 : 401, {}];
  }
  const path = Object.keys(lists).find(
    (candidate) => url.pathname === candidate || url.pathname.startsWith(`${candidate}/`),
  );
  if (!path) {
    return undefined;
  }
  if (account?.role !== "operator") {
    return [account ? 403 : 401, {}];
  }
  const { records, idOf, statusOf, textOf, summaryOf, countryOf } = lists[path];
  if (url.pathname === path) {
    const found = page(url, records, statusOf, textOf, summaryOf, countryOf);
    return [
      200,
      path === "/api/solution/admin/solutions"
        ? {
            ...found,
            organizations: [
              ...new Map(
                records.map((record) => [
                  record.organizationId,
                  { id: record.organizationId, name: record.organizationName },
                ]),
              ).values(),
            ].sort((left, right) => left.name.localeCompare(right.name)),
            awaitingReview: records.filter((record) => record.status === "in_review").length,
            deploymentsAwaitingReview: records
              .flatMap((record) => record.customerDeployments)
              .filter((item) => item.status === "in_review").length,
          }
        : found,
    ];
  }
  const record = records.find(
    (candidate) => idOf(candidate) === url.pathname.slice(path.length + 1),
  );
  return record ? [200, record] : [404, { status: 404, code: "NOT_FOUND" }];
}
