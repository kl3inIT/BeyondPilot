// Messages, as the backend answers it for these tests.
//
// - Minh Trần, the owner of Pocket Policy (`owner`), talks with Arif Hidayat, whose two last
//   messages he has not read, waits for Staple AI to accept a first message, and has one request to
//   answer, from Hà Lê of Mekong Insurance about Policy Chat. Everyone else has no conversation.
// - A first message may be written to the talent profile of Arif Hidayat, to the solution Policy
//   Chat and to the program GenAI Builders Hanoi; the owner of Pocket Policy may not write to their
//   own solution.
// - The operators read one reported first message.
//
// The stub keeps nothing: what a test writes is answered as the backend would answer it, and the
// lists stay as they are. The stream of events sends its opening comment and stays open, so a
// screen hears nothing more unless a test routes the stream itself.

const hour = 60 * 60 * 1000;
const ago = (hours) => new Date(Date.now() - hours * hour).toISOString();
const inDays = (days) => new Date(Date.now() + days * 24 * hour).toISOString();

const arifChat = "c0a1b2c3-0001-4d5e-8f90-a1b2c3d4e501";
const stapleChat = "c0a1b2c3-0002-4d5e-8f90-a1b2c3d4e502";
const haRequest = "c0a1b2c3-0003-4d5e-8f90-a1b2c3d4e503";
/** The conversation a first message starts. */
const started = "c0a1b2c3-0009-4d5e-8f90-a1b2c3d4e509";

const subject = (kind, name, slug, more = {}) => ({
  kind,
  name,
  slug,
  summary: null,
  headline: null,
  organizationName: null,
  maturity: null,
  city: null,
  country: null,
  roles: [],
  skills: [],
  industries: [],
  customerDeployments: 0,
  ...more,
});

const arif = subject("talent", "Arif Hidayat", "arif-hidayat", {
  headline: "ML engineer for document pipelines",
  country: "ID",
  roles: ["ml_engineer"],
  skills: ["PyTorch", "OCR"],
});
const policyChat = subject("solution", "Policy Chat", "policy-chat", {
  summary: "Answers policy questions for an insurer's customers.",
  organizationName: "Pocket Policy",
  industries: ["insurance"],
});
const stapleAi = subject("solution", "Staple AI", "staple-ai", {
  summary: "Reads invoices and claim forms.",
  organizationName: "Staple AI",
  industries: ["insurance"],
});
const buildersHanoi = subject("program", "GenAI Builders Hanoi", "genai-builders-hanoi");

const conversation = (id, more) => ({
  id,
  status: "accepted",
  side: "starter",
  counterpartOrganization: null,
  unread: 0,
  canWrite: true,
  canAnswer: false,
  closesAt: null,
  createdAt: ago(72),
  lastMessageAt: ago(1),
  lastMessage: null,
  ...more,
});

const message = (id, seq, body, more = {}) => ({
  id,
  seq,
  body,
  createdAt: ago(1),
  fromStarter: true,
  mine: false,
  senderName: null,
  ...more,
});

/** The owner's conversations, each with what one read of it answers. */
const details = {
  [arifChat]: {
    conversation: conversation(arifChat, {
      kind: "talent",
      subjectName: "Arif Hidayat",
      counterpartName: "Arif Hidayat",
      unread: 2,
      lastMessage: { preview: "I can start in November.", mine: false, senderName: "Arif Hidayat" },
    }),
    messages: [
      message("a0000000-0000-4000-8000-000000000001", 11, "Could you review our OCR pipeline?", {
        createdAt: ago(30),
        mine: true,
        senderName: "Minh Trần",
      }),
      message("a0000000-0000-4000-8000-000000000002", 12, "Yes. Which documents do you read?", {
        createdAt: ago(3),
        fromStarter: false,
        senderName: "Arif Hidayat",
      }),
      message("a0000000-0000-4000-8000-000000000003", 13, "I can start in November.", {
        createdAt: ago(2),
        fromStarter: false,
        senderName: "Arif Hidayat",
      }),
    ],
    hasEarlier: false,
    readByOtherSide: 11,
    subject: arif,
    participants: [{ name: "Arif Hidayat", organizationName: null, role: "person" }],
  },
  [stapleChat]: {
    conversation: conversation(stapleChat, {
      kind: "solution",
      status: "pending",
      subjectName: "Staple AI",
      counterpartName: "Staple AI",
      canWrite: false,
      closesAt: inDays(9),
      lastMessageAt: ago(100),
      lastMessage: { preview: "Can it read our claim forms?", mine: true, senderName: "Minh Trần" },
    }),
    messages: [
      message("a0000000-0000-4000-8000-000000000011", 5, "Can it read our claim forms?", {
        createdAt: ago(100),
        mine: true,
        senderName: "Minh Trần",
      }),
    ],
    hasEarlier: false,
    readByOtherSide: 0,
    subject: stapleAi,
    participants: [{ name: "Wei Ling", organizationName: "Staple AI", role: "owner" }],
  },
  [haRequest]: {
    conversation: conversation(haRequest, {
      kind: "solution",
      status: "pending",
      side: "recipient",
      subjectName: "Policy Chat",
      counterpartName: "Hà Lê",
      counterpartOrganization: "Mekong Insurance",
      canWrite: false,
      canAnswer: true,
      closesAt: inDays(12),
      lastMessageAt: ago(5),
      lastMessage: {
        preview: "We want a renewals assistant for our clinics.",
        mine: false,
        senderName: "Hà Lê",
      },
    }),
    messages: [
      message(
        "a0000000-0000-4000-8000-000000000021",
        20,
        "We want a renewals assistant for our clinics.",
        {
          createdAt: ago(5),
          senderName: "Hà Lê",
        },
      ),
    ],
    hasEarlier: false,
    readByOtherSide: 0,
    subject: policyChat,
    participants: [{ name: "Hà Lê", organizationName: "Mekong Insurance", role: "person" }],
  },
};

const lists = {
  owner: {
    chats: [details[arifChat].conversation, details[stapleChat].conversation],
    requests: [details[haRequest].conversation],
    unread: 2,
  },
  unnamed: { chats: [], requests: [], unread: 0 },
};

const nobody = { chats: [], requests: [], unread: 0 };

/** Who a first message would go to, by `kind/slug`. */
const prospects = {
  "talent/arif-hidayat": {
    subject: arif,
    counterpartName: "Arif Hidayat",
    request: true,
    participants: [{ name: "Arif Hidayat", organizationName: null, role: "person" }],
  },
  "solution/policy-chat": {
    subject: policyChat,
    counterpartName: "Pocket Policy",
    request: true,
    participants: [{ name: "Minh Trần", organizationName: "Pocket Policy", role: "owner" }],
  },
  "program/genai-builders-hanoi": {
    subject: buildersHanoi,
    counterpartName: null,
    request: false,
    participants: [],
  },
};

/** The first messages reported as unwanted, as the operators read them. */
const reported = [
  {
    id: "c0a1b2c3-0031-4d5e-8f90-a1b2c3d4e531",
    kind: "talent",
    subjectName: "Siti Rahma",
    senderName: null,
    senderEmail: "growth@spam.example",
    senderOrganization: null,
    message: "Buy ten thousand followers for your profile.",
    createdAt: "2026-10-03T03:00:00Z",
    reportedAt: "2026-10-04T03:00:00Z",
  },
  {
    id: "c0a1b2c3-0032-4d5e-8f90-a1b2c3d4e532",
    kind: "solution",
    subjectName: "Policy Chat",
    senderName: "Quang Vũ",
    senderEmail: "",
    senderOrganization: "First Call",
    message: "Cheap leads for your sales team.\nAnswer today.",
    createdAt: "2026-10-01T03:00:00Z",
    reportedAt: "2026-10-02T03:00:00Z",
  },
];

const refused = (status, code) => [status, { status, code }];

function bodyOf(request) {
  return new Promise((resolve) => {
    let text = "";
    request.on("data", (chunk) => (text += chunk));
    request.on("end", () => resolve(text ? JSON.parse(text) : null));
  });
}

/** The conversation a first message to `prospect` starts, as the person who wrote it reads it. */
function startedWith(prospect, id, body, name) {
  const program = prospect.subject.kind === "program";
  return {
    conversation: conversation(started, {
      kind: prospect.subject.kind,
      status: program ? "accepted" : "pending",
      subjectName: prospect.subject.name,
      counterpartName: prospect.counterpartName,
      canWrite: program,
      closesAt: program ? null : inDays(14),
      createdAt: ago(0),
      lastMessageAt: ago(0),
      lastMessage: { preview: body, mine: true, senderName: name },
    }),
    messages: [
      message(id, 91, body, {
        createdAt: ago(0),
        mine: true,
        senderName: name,
      }),
    ],
    hasEarlier: false,
    readByOtherSide: 0,
    subject: prospect.subject,
    participants: prospect.participants,
  };
}

/**
 * What the backend answers under `/api/messaging`, to the web server and to a browser whose test
 * sends its requests here. Returns whether the request was one of them.
 */
export function serveMessaging(request, response, url, session, account) {
  const { pathname } = url;
  if (!pathname.startsWith("/api/messaging/")) {
    return false;
  }
  const json = (status, body) => {
    response.writeHead(status, {
      "Content-Type": status < 400 ? "application/json" : "application/problem+json",
    });
    response.end(body === undefined ? undefined : JSON.stringify(body));
  };
  if (!account) {
    json(401, {});
    return true;
  }
  if (pathname === "/api/messaging/events") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    });
    response.write(":open\n\n");
    return true;
  }
  const mine = lists[session] ?? nobody;
  if (pathname === "/api/messaging/unread") {
    json(200, { unread: mine.unread, requests: mine.requests.length });
    return true;
  }
  if (pathname === "/api/messaging/admin/reported") {
    if (account.role !== "operator") {
      json(403, {});
      return true;
    }
    const page = Number(url.searchParams.get("page") ?? 1);
    const size = Number(url.searchParams.get("size") ?? 25);
    json(200, {
      items: reported.slice((page - 1) * size, page * size),
      page,
      pageSize: size,
      total: reported.length,
    });
    return true;
  }
  if (pathname === "/api/messaging/prospect") {
    const key = `${url.searchParams.get("kind")}/${url.searchParams.get("slug")}`;
    const prospect = prospects[key];
    if (!prospect) {
      json(...refused(404, "MESSAGING_SUBJECT_NOT_FOUND"));
    } else if (key === "solution/policy-chat" && session === "owner") {
      json(...refused(409, "MESSAGING_OWN_SUBJECT"));
    } else {
      json(200, { ...prospect, conversationId: null });
    }
    return true;
  }
  if (pathname === "/api/messaging/conversations") {
    if (request.method === "GET") {
      json(200, mine);
      return true;
    }
    void bodyOf(request).then((body) => {
      const prospect = prospects[`${body.kind}/${body.slug}`];
      if (!prospect) {
        return json(...refused(404, "MESSAGING_SUBJECT_NOT_FOUND"));
      }
      const created = startedWith(prospect, body.id, body.body, account.displayName);
      details[started] = created;
      mine.chats = [created.conversation, ...mine.chats.filter((chat) => chat.id !== started)];
      json(200, created);
    });
    return true;
  }
  const [, id, action] =
    /^\/api\/messaging\/conversations\/([^/]+)(?:\/([a-z]+))?$/.exec(pathname) ?? [];
  const detail = mine === nobody ? undefined : details[id];
  if (!detail) {
    json(...refused(404, "MESSAGING_CONVERSATION_NOT_FOUND"));
    return true;
  }
  if (!action) {
    json(200, detail);
  } else if (action === "messages" && request.method === "GET") {
    json(200, { messages: [], hasMore: false, readByOtherSide: detail.readByOtherSide });
  } else if (action === "messages") {
    void bodyOf(request).then((body) =>
      json(
        200,
        message(body.id, 100, body.body, {
          createdAt: ago(0),
          fromStarter: detail.conversation.side === "starter",
          mine: true,
          senderName: account.displayName,
        }),
      ),
    );
  } else if (action === "accept") {
    json(200, {
      ...detail,
      conversation: {
        ...detail.conversation,
        status: "accepted",
        canWrite: true,
        canAnswer: false,
      },
    });
  } else {
    // read, typing, decline, report
    json(204);
  }
  return true;
}
