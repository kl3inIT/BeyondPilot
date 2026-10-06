// What the stub backend holds of a signed-in person's own records: their organization and its
// members, its solutions, and their talent profile. The account behind the request decides what it
// reads: an owner and a member of the same approved provider, a person invited to it, a person who
// asked to join it, and people who belong to no organization.

const day = "2026-10-01T03:00:00Z";

const pocketPolicy = {
  id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
  name: "Pocket Policy",
  slug: "pocket-policy",
  status: "approved",
  type: "company",
  roles: ["provider"],
  country: "SG",
  teamSize: "10_49",
  industries: ["insurance"],
  website: "https://pocketpolicy.example",
  emailDomain: "pocketpolicy.example",
  description: "Assistants for insurers across Southeast Asia.",
  autoJoin: false,
  version: 3,
  createdAt: day,
};

/** An organization that waits for GenAI Fund's approval, with its owner. */
const newCo = {
  ...pocketPolicy,
  id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c04",
  name: "Newco",
  slug: "newco",
  status: "pending",
  roles: ["enterprise"],
  emailDomain: "newco.example",
};

const ofPocketPolicy = { organizationId: pocketPolicy.id, organizationName: pocketPolicy.name };

const invitation = {
  id: "9c4f6d85-3c31-4d86-8d88-3a6c9c9e0d11",
  email: "hoa.le@example.com",
  role: "member",
  invitedBy: "Minh Trần",
  createdAt: day,
  ...ofPocketPolicy,
};

const request = {
  id: "9c4f6d85-3c31-4d86-8d88-3a6c9c9e0d12",
  claim: false,
  name: "Nam Đỗ",
  email: "nam.do@pocketpolicy.example",
  message: "I joined the claims team.",
  createdAt: day,
  ...ofPocketPolicy,
};

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

/** Whom each signed-in account is to the organization: `[its role in it, what waits for it]`. */
const standing = {
  owner: { role: "owner" },
  member: { role: "member" },
  invited: { invitations: [invitation] },
  asked: { request },
  waiting: { role: "owner", organization: newCo },
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
    website: "https://pocketpolicy.example",
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
    customerDeployments: [
      deployment("be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f11", "Renewals at Mekong Life", "approved"),
      deployment("be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f12", "Claims line at Bảo An", "rejected", {
        customer: "A regional insurer",
        decisionReason: "unverifiable",
        decisionMessage: "Who can confirm it?",
      }),
    ],
  }),
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e12", "Claims Vision", "submitted"),
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e13", "Fraud Lens", "draft", {
    summary: null,
    problemsSolved: null,
    website: null,
    focusAreas: [],
    industries: [],
    deployment: [],
    maturity: undefined,
    complete: false,
    submittedAt: null,
    version: 0,
  }),
  solution("ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e14", "Quote Bot", "rejected", {
    decisionReason: "duplicate",
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
  listed: item.listed,
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

/** The talent profile of the accounts that have one, with the messages sent through it. */
const talent = {
  operator: {
    profile: profile("Đạt Phan", "dat-phan", "approved"),
    enquiries: [
      {
        id: "d08dabc9-7a75-4bca-8bc2-7e0a3a3c4b01",
        senderName: "Hà Lê",
        senderOrganization: "Mekong Insurance",
        senderEmail: null,
        topic: "project",
        message: "We are scoping a claims assistant and would like your view.",
        status: "pending",
        createdAt: day,
        answeredAt: null,
        closesAt: "2026-10-20T03:00:00Z",
      },
      {
        id: "5b1c2f0e-9d61-4a55-8f0c-2a6f3e0c9e12",
        senderName: "Minh Trần",
        senderOrganization: null,
        senderEmail: "minh.tran@example.com",
        topic: "role",
        message: "Would you join our team for a pilot?",
        status: "accepted",
        createdAt: day,
        answeredAt: day,
        closesAt: null,
      },
    ],
  },
  member: {
    profile: profile("Siti Rahma", "siti-rahma", "changes_requested", {
      projects: [],
      decisionReason: "incomplete",
      decisionMessage: "Add a project.",
    }),
    enquiries: [],
  },
};

/** The requests for an introduction to Pocket Policy: one waiting, one answered each way. */
const introductions = [
  {
    id: "e19ebcda-8b86-4cd9-9cd3-8f1b4b4d5c21",
    solutionName: "Policy Chat",
    senderOrganization: "Lumen Health",
    senderName: "Hà Lê",
    senderEmail: null,
    message: "We want a renewals assistant for our clinics.",
    status: "pending",
    createdAt: day,
    answeredAt: null,
  },
  {
    id: "e19ebcda-8b86-4cd9-9cd3-8f1b4b4d5c22",
    solutionName: "Claims Vision",
    senderOrganization: "Mekong Life",
    senderName: null,
    senderEmail: "claims@mekong.example",
    message: "Can it read our scanned claim forms?",
    status: "replied",
    createdAt: day,
    answeredAt: day,
  },
  {
    id: "e19ebcda-8b86-4cd9-9cd3-8f1b4b4d5c23",
    solutionName: "Agent Coach",
    senderOrganization: "Bảo An",
    senderName: "Quang Vũ",
    senderEmail: null,
    message: "Do you coach agents in Vietnamese?",
    status: "declined",
    createdAt: day,
    answeredAt: day,
  },
];

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
    "/api/talent/mine",
    "/api/introduction/mine/received",
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
    invitations = [],
    request: asked = null,
  } = standing[session] ?? {};

  if (pathname === "/api/organization/mine") {
    const jobTitle = members.find((person) => person.role === role)?.jobTitle ?? null;
    return [
      200,
      { organization: role ? organization : null, role, jobTitle, invitations, request: asked },
    ];
  }
  if (pathname === "/api/introduction/mine/received") {
    return role
      ? [200, { editable: role === "owner", items: introductions }]
      : refused(403, "INTRODUCTION_NEEDS_ORGANIZATION");
  }
  if (pathname === "/api/talent/mine") {
    return [200, talent[session] ?? { profile: null, enquiries: [] }];
  }
  if (pathname === "/api/organization/mine/members") {
    if (!role) {
      return refused(403, "ORGANIZATION_MEMBERSHIP_REQUIRED");
    }
    return [
      200,
      {
        members: members.map((person) => ({ ...person, self: person.role === role })),
        invitations: [invitation],
        requests: [request],
      },
    ];
  }
  if (pathname === "/api/solution/mine") {
    // A person without an organization has no solutions, and is not refused.
    return [200, { editable: role === "owner", items: role ? solutions.map(summaryOf) : [] }];
  }
  const found = role && solutions.find((item) => pathname === `/api/solution/mine/${item.id}`);
  return found ? [200, found] : refused(404, "SOLUTION_NOT_FOUND");
}
