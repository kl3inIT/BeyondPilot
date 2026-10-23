// What the stub backend holds of a signed-in person's own records: their organization and its
// members, its solutions, and their talent profile. The account behind the request decides what it
// reads: an owner and a member of the same active organization, a person invited to it, a person who
// asked to join it, a person its owners declined, and people who belong to no organization.

const day = "2026-10-01T03:00:00Z";

const pocketPolicy = {
  id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
  name: "Pocket Policy",
  slug: "pocket-policy",
  status: "active",
  type: "company",
  country: "SG",
  teamSize: "10_49",
  industries: ["insurance"],
  website: "https://pocketpolicy.example",
  emailDomain: "pocketpolicy.example",
  description: "Assistants for insurers across Southeast Asia.",
  foundedYear: 2021,
  logoFileId: null,
  autoJoin: false,
  version: 3,
  createdAt: day,
};

/** An organization made a moment ago: active from the start, with its owner. */
const newCo = {
  ...pocketPolicy,
  id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c04",
  name: "Newco",
  slug: "newco",
  roles: ["enterprise"],
  emailDomain: "newco.example",
};

/** An organization of one person: Just me, active when it was made. */
const justMe = {
  ...pocketPolicy,
  id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c05",
  name: "An Tr?n",
  slug: "an-tran",
  type: "independent_builder",
  teamSize: "just_me",
  industries: [],
  website: null,
  emailDomain: null,
  foundedYear: null,
};

const ofPocketPolicy = { organizationId: pocketPolicy.id, organizationName: pocketPolicy.name };

/** What a request to get into the organization says about it. */
const aboutPocketPolicy = {
  ...ofPocketPolicy,
  organizationType: pocketPolicy.type,
  organizationCountry: pocketPolicy.country,
  organizationDomain: pocketPolicy.emailDomain,
};

const invitation = {
  id: "9c4f6d85-3c31-4d86-8d88-3a6c9c9e0d11",
  email: "hoa.le@example.com",
  role: "member",
  invitedBy: "Minh Trần",
  createdAt: day,
  expiresAt: "2026-10-08T03:00:00Z",
  ...ofPocketPolicy,
};

const request = {
  id: "9c4f6d85-3c31-4d86-8d88-3a6c9c9e0d12",
  claim: false,
  name: "Nam Đỗ",
  email: "nam.do@pocketpolicy.example",
  message: "I joined the claims team.",
  createdAt: day,
  ...aboutPocketPolicy,
};

/** The answer to a request the owners declined. */
const declined = { claim: false, decidedAt: day, ...aboutPocketPolicy };

const members = [
  {
    accountId: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a04",
    name: "Minh Trần",
    email: "minh.tran@pocketpolicy.example",
    role: "owner",
    jobTitle: "Founder",
    joinedAt: day,
  },
  {
    accountId: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a12",
    name: "Siti Rahma",
    email: "siti@pocketpolicy.example",
    role: "member",
    jobTitle: null,
    joinedAt: day,
  },
];

/** The members read at a time, as the backend pages them. */
const membersPageSize = 10;

/** An organization of twelve: the two above and ten more, so the members take two pages. */
const crowd = [
  ...members,
  ...Array.from({ length: 10 }, (_, index) => ({
    accountId: `6f1c3a52-0f0e-4a53-9a55-0d3f6f6b8a${String(index).padStart(2, "0")}`,
    name: `Member ${index + 3}`,
    email: `member${index + 3}@pocketpolicy.example`,
    role: "member",
    jobTitle: null,
    joinedAt: day,
  })),
];

/** Whom each signed-in account is to the organization: `[its role in it, what waits for it]`. */
const standing = {
  owner: { role: "owner" },
  crowd: { role: "owner", crowd: true },
  member: { role: "member" },
  invited: { invitations: [invitation] },
  asked: { request },
  declined: { declined },
  fresh: { role: "owner", organization: newCo },
  alone: { role: "owner", organization: justMe },
  moved: {
    role: "member",
    mergedFrom: {
      name: "Pocket Policy Ltd",
      slug: "pocket-policy-ltd",
      mergedAt: "2026-10-07T03:00:00Z",
    },
  },
};

function deployment(id, title, status, more) {
  return {
    id,
    title,
    status,
    customer: "Mekong Life",
    stage: "production",
    problem: "Renewal questions filled the call centre every quarter.",
    delivered: "A chat assistant on the renewals page.",
    channels: "Chat",
    languages: null,
    period: null,
    result: null,
    version: 2,
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
    ...ofPocketPolicy,
    summary: `${name} for insurers.`,
    problemsSolved: "Policy holders wait days for an answer.",
    valueProposition: null,
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

/** The solutions of the organization, as its people read them. */
const solutions = [
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e11", "Policy Chat", "approved", {
    maturity: "production",
    builtWith: ["Python", "PostgreSQL"],
    languages: ["vi", "en"],
    deck: {
      fileId: "d0c1a2b3-4c5d-4e6f-8a9b-0c1d2e3f4a51",
      fileName: "policy-chat-deck.pdf",
      sizeBytes: 3250586,
      attachedAt: day,
    },
    customerDeployments: [
      deployment("be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f11", "Renewals at Mekong Life", "approved"),
      deployment("be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f12", "Claims line at Bảo An", "rejected", {
        customer: "A regional insurer",
        decisionReason: "unverifiable",
        decisionMessage: "Who can confirm it?",
      }),
    ],
  }),
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e12", "Claims Vision", "in_review"),
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e13", "Fraud Lens", "draft", {
    summary: null,
    problemsSolved: null,
    website: null,
    focusAreas: [],
    industries: [],
    deployment: [],
    maturity: undefined,
    logo: null,
    cover: null,
    complete: false,
    submittedAt: null,
    version: 0,
  }),
  // Sent back by GenAI Fund with what to change; its owners correct it and send it again.
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e14", "Quote Bot", "needs_changes", {
    decisionMessage: "It is Policy Chat under another name.",
  }),
];

const summaryOf = (item) => ({
  id: item.id,
  name: item.name,
  slug: item.slug,
  status: item.status,
  organizationName: item.organizationName,
  summary: item.summary,
  maturity: item.maturity,
  decisionReason: item.decisionReason ?? null,
  decisionMessage: item.decisionMessage ?? null,
  suspendedAt: item.suspendedAt ?? null,
  suspensionReason: item.suspensionReason ?? null,
  suspensionMessage: item.suspensionMessage ?? null,
  listed: item.listed,
  // What a review needs and the solution lacks, as the backend names it.
  missing: [
    ...(item.summary ? [] : ["summary"]),
    ...(item.maturity ? [] : ["maturity"]),
    ...(item.industries.length > 0 ? [] : ["industries"]),
    ...(item.focusAreas.length > 0 ? [] : ["focusAreas"]),
    ...(item.logo ? [] : ["logo"]),
    ...(item.cover ? [] : ["cover"]),
  ],
  submittedAt: item.submittedAt,
  updatedAt: item.updatedAt,
  deploymentsAwaitingReview: 0,
});

function profile(name, slug, status, more) {
  return {
    id: "cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a11",
    name,
    slug,
    status,
    headline: "Ships assistants into call centres",
    bio: "Five years of putting language models in front of customers.",
    country: "VN",
    website: null,
    roles: ["ai_consultant"],
    skills: ["Strategy"],
    engagement: ["advisory"],
    rateBand: "100_150",
    photoFileId: null,
    city: null,
    languages: [],
    industries: [],
    worksAt: null,
    projects: [
      {
        title: "Claims assistant for an insurer",
        year: 2025,
        summary: null,
        url: null,
        stage: null,
      },
    ],
    listed: true,
    complete: true,
    submittedAt: day,
    updatedAt: day,
    version: 4,
    ...more,
  };
}

/** The talent profile of the accounts that have one. */
const talent = {
  operator: {
    profile: profile("Đạt Phan", "dat-phan", "approved"),
  },
  member: {
    profile: profile("Siti Rahma", "siti-rahma", "needs_changes", {
      projects: [],
      decisionReason: "incomplete",
      decisionMessage: "Add a project.",
    }),
  },
};

const refused = (status, code) => [status, { status, code }];

/**
 * The answer to a signed-in person's read of their own records, as `[status, body]`; nothing for
 * another path. `session` names the account, as the cookie does.
 */
export function answerWorkspace(url, session) {
  const { pathname } = url;
  const known = [
    "/api/organization/mine",
    "/api/organization/mine/members",
    "/api/solution/mine",
    "/api/usecase/mine",
    "/api/talent/mine",
    "/api/perk/claims",
    "/api/perk/mine",
  ];
  if (!known.includes(pathname) && !pathname.startsWith("/api/solution/mine/")) {
    return undefined;
  }
  if (!session) {
    return [401, {}];
  }
  const {
    role,
    organization = pocketPolicy,
    crowd: crowded = false,
    invitations = [],
    request: asked = null,
    declined: refusedRequest = null,
    mergedFrom = null,
  } = standing[session] ?? {};

  if (pathname === "/api/organization/mine") {
    const jobTitle = members.find((person) => person.role === role)?.jobTitle ?? null;
    return [
      200,
      {
        organization: role ? organization : null,
        role,
        jobTitle,
        invitations,
        request: asked,
        declined: refusedRequest,
        mergedFrom,
      },
    ];
  }
  if (pathname === "/api/talent/mine") {
    return [200, talent[session] ?? { profile: null }];
  }
  if (pathname === "/api/organization/mine/members") {
    if (!role) {
      return refused(403, "ORGANIZATION_MEMBERSHIP_REQUIRED");
    }
    const everyone = crowded ? crowd : members;
    const page = Number(url.searchParams.get("page") ?? 1);
    return [
      200,
      {
        members: everyone
          .slice((page - 1) * membersPageSize, page * membersPageSize)
          .map((person) => ({
            ...person,
            self: person === everyone.find((one) => one.role === role),
          })),
        page,
        pageSize: membersPageSize,
        total: everyone.length,
        invitations: [invitation],
        requests: [request],
      },
    ];
  }
  if (pathname === "/api/usecase/mine") {
    // Anyone who belongs to an active organization may read its use cases; the stub has none.
    return role ? [200, { items: [] }] : refused(403, "USECASE_ENTERPRISE_REQUIRED");
  }
  if (pathname === "/api/perk/claims" || pathname === "/api/perk/mine") {
    // The organization has got no perk and gives none.
    return [200, []];
  }
  if (pathname === "/api/solution/mine") {
    // A person without an organization has no solutions, and is not refused.
    return [200, { editable: role === "owner", items: role ? solutions.map(summaryOf) : [] }];
  }
  const found = role && solutions.find((item) => pathname === `/api/solution/mine/${item.id}`);
  return found ? [200, found] : refused(404, "SOLUTION_NOT_FOUND");
}
