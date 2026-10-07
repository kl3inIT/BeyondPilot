// Stands in for the backend where the web server itself asks it something: the session and the
// lists a page reads on the server, which a browser-side route cannot answer. The cookie's value
// picks the account, so a test signs in by setting a cookie. What the browser sends (a command, a
// sign-out) is answered by the test itself, with page.route.
import { createServer } from "node:http";

import { answerApplication } from "./stub-applications.mjs";
import { answerDirectory } from "./stub-directories.mjs";
import { answerEmail } from "./stub-email.mjs";
import { answerJudging } from "./stub-judging.mjs";
import { answerReview } from "./stub-reviews.mjs";
import { answerSearch, answerSearchAdmin } from "./stub-search.mjs";
import { answerWorkspace } from "./stub-workspace.mjs";

const accounts = {
  // Invited by GenAI Fund to judge the Tasco challenge (stub-judging.mjs).
  judge: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a20",
    email: "judge@tasco.example",
    displayName: "Lan Vu",
    role: "user",
  },
  operator: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a01",
    email: "dat.phan@example.com",
    displayName: "Đạt Phan",
    role: "operator",
  },
  // An operator of a deployment whose email is set up with Amazon SES (stub-email.mjs).
  emailer: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a30",
    email: "ops@beyondpilot.ai",
    displayName: "Hà Lê",
    role: "operator",
  },
  unnamed: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a02",
    email: "an.tran@example.com",
    displayName: null,
    role: "user",
  },
  // The people of one organization, and two on their way into it (stub-workspace.mjs).
  owner: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a04",
    email: "minh.tran@pocketpolicy.example",
    displayName: "Minh Trần",
    role: "user",
  },
  // The owner of the same organization when it has twelve people (stub-workspace.mjs).
  crowd: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a04",
    email: "minh.tran@pocketpolicy.example",
    displayName: "Minh Trần",
    role: "user",
  },
  member: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a12",
    email: "siti@pocketpolicy.example",
    displayName: "Siti Rahma",
    role: "user",
  },
  invited: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a13",
    email: "hoa.le@example.com",
    displayName: "Hoa Lê",
    role: "user",
  },
  asked: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a14",
    email: "nam.do@pocketpolicy.example",
    displayName: "Nam Đỗ",
    role: "user",
  },
  declined: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a15",
    email: "an.vo@example.com",
    displayName: "An Võ",
    role: "user",
  },
  // The owner of an organization that GenAI Fund has not approved yet (stub-workspace.mjs).
  waiting: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a16",
    email: "lan.pham@newco.example",
    displayName: "Lan Phạm",
    role: "user",
  },
};

/** What the operators' list holds, latest sign-in first. */
const listed = [
  {
    ...accounts.operator,
    status: "active",
    lastSignInAt: "2026-10-04T14:36:00Z",
    configuredOperator: true,
  },
  {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a03",
    email: "ha.le@example.com",
    displayName: "Hà Lê",
    role: "operator",
    status: "active",
    lastSignInAt: "2026-10-04T09:05:00Z",
    configuredOperator: false,
  },
  {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a04",
    email: "minh.tran@pocketpolicy.example",
    displayName: "Minh Trần",
    role: "user",
    status: "active",
    lastSignInAt: "2026-10-03T07:32:00Z",
    configuredOperator: false,
  },
  {
    ...accounts.unnamed,
    status: "active",
    lastSignInAt: "2026-10-02T02:12:00Z",
    configuredOperator: false,
  },
  {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a05",
    email: "quang.vu@firstcall.example",
    displayName: "Quang Vũ",
    role: "user",
    status: "disabled",
    lastSignInAt: "2026-09-29T13:05:00Z",
    configuredOperator: false,
  },
].map((account) => ({ ...account, createdAt: "2026-09-28T03:00:00Z" }));

const hour = 60 * 60 * 1000;
const dat = { id: accounts.operator.id, label: "Đạt Phan", email: accounts.operator.email };
const ha = {
  id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a03",
  label: "Hà Lê",
  email: "ha.le@example.com",
};

/**
 * What the audit log holds, newest first: (hours ago, action, actor, resource). The times count
 * back from the moment the stub starts, so the first four always fall within the last seven days.
 */
const events = [
  [1, "account.disable", dat, "Quang Vũ"],
  [2, "operator.grant", ha, "Minh Trần"],
  [20, "operator.grant", null, "Đạt Phan"],
  [50, "operator.withdraw", dat, "Arif Hidayat"],
  [20 * 24, "account.enable", ha, "Siti Rahma"],
].map(([hoursAgo, action, actor, label], index) => ({
  id: `7a2d4b63-1a1f-4b64-8b66-1e4a7a7c8b0${index}`,
  occurredAt: new Date(Date.now() - hoursAgo * hour).toISOString(),
  action,
  actor,
  resource: { type: "account", id: `6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7b0${index}`, label },
  details: action === "operator.grant" ? { source: actor ? "operator" : "configuration" } : {},
  requestId: null,
}));

/** The programs an operator edits: a draft that lacks what publishing needs, and a published one. */
const programs = {
  "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c01": {
    id: "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c01",
    slug: "genai-monthly-meetup",
    slugFixed: false,
    publishIssues: ["summary", "cover", "dates"],
    name: "GenAI Monthly Meetup",
    type: "event_series",
    partnerName: null,
    summary: null,
    about: null,
    startsOn: null,
    endsOn: null,
    status: "draft",
    pageKind: "standard",
    externalUrl: null,
    coverFileId: null,
    keyDates: [],
    events: [],
    version: 0,
    createdAt: "2026-10-05T03:00:00Z",
    updatedAt: "2026-10-05T03:00:00Z",
  },
  "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c02": {
    id: "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c02",
    slug: "insurance-ai-tasco",
    slugFixed: true,
    publishIssues: [],
    name: "AI for Insurance Challenge × Tasco",
    type: "enterprise_challenge",
    partnerName: "Tasco",
    summary:
      "In Vietnam, insurance is still a piece of paper you can lose. Change that by 15 October.",
    about: null,
    startsOn: "2026-09-23",
    endsOn: "2026-12-05",
    status: "published",
    pageKind: "custom",
    externalUrl: null,
    coverFileId: "4c0d5f9e-2b1a-4e3c-8d7f-6a5b4c3d2e01",
    applications: {
      opensAt: "2026-09-22T17:00:00Z",
      closesAt: "2026-10-15T16:59:00Z",
      shortlistSize: 10,
      outcomesDueOn: "2026-10-16",
      allowUpdatesUntilClose: true,
    },
    keyDates: [
      {
        title: "Briefing with Tasco's business team",
        startsAt: "2026-10-07T08:30:00Z",
        endsAt: "2026-10-07T10:00:00Z",
        allDay: false,
        note: "Online",
      },
    ],
    events: [],
    version: 4,
    createdAt: "2026-09-20T03:00:00Z",
    updatedAt: "2026-10-04T03:00:00Z",
  },
};

const day = 24 * hour;
const inDays = (days) => new Date(Date.now() + days * day).toISOString();

/** The published programs and a draft, as visitors read them; dates count from the stub's start. */
const publicPrograms = {
  "insurance-ai-tasco": {
    id: "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c02",
    slug: "insurance-ai-tasco",
    name: "AI for Insurance Challenge × Tasco",
    type: "enterprise_challenge",
    partnerName: "Tasco",
    summary:
      "In Vietnam, insurance is still a piece of paper you can lose. Change that by 15 October.",
    about: null,
    coverFileId: null,
    phase: "open",
    status: "published",
    startsOn: "2026-09-23",
    endsOn: "2026-12-05",
    pageKind: "custom",
    externalUrl: null,
    applications: {
      opensAt: inDays(-12),
      closesAt: inDays(10),
      shortlistSize: 10,
      outcomesDueOn: inDays(11).slice(0, 10),
      allowUpdatesUntilClose: true,
    },
    keyDates: [
      {
        title: "Demo day: ten teams present live",
        startsAt: inDays(17),
        endsAt: inDays(17.1),
        allDay: false,
        note: "Virtual",
      },
    ],
    events: [
      {
        title: "Stop Guessing What Insurers Need: Tasco Challenge Briefing",
        startsAt: inDays(2),
        endsAt: null,
        online: true,
        city: null,
        country: null,
        registrationUrl: "https://luma.com/tasco-briefing",
      },
    ],
  },
  "genai-builders-hanoi": {
    id: "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c03",
    slug: "genai-builders-hanoi",
    name: "GenAI Builders Hanoi",
    type: "event_series",
    partnerName: null,
    summary: "Builders meet once a month to show what they shipped.",
    about: [
      "Every month, builders in Hanoi show what they shipped and what broke.",
      "Bring a demo.",
    ].join("\n\n"),
    coverFileId: null,
    phase: "upcoming",
    status: "published",
    startsOn: inDays(30).slice(0, 10),
    endsOn: inDays(30).slice(0, 10),
    pageKind: "standard",
    externalUrl: null,
    keyDates: [
      { title: "Doors open", startsAt: inDays(30), endsAt: null, allDay: false, note: null },
    ],
    events: [],
  },
  "agentic-ai-build-week-2026": {
    id: "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c04",
    slug: "agentic-ai-build-week-2026",
    name: "Agentic AI Build Week 2026",
    type: "buildathon",
    partnerName: null,
    summary: "3,230 builders, five days.",
    about: null,
    coverFileId: null,
    phase: "done",
    status: "published",
    startsOn: "2026-07-08",
    endsOn: "2026-07-12",
    pageKind: "external",
    externalUrl: "https://genaifund.ai/blog/",
    keyDates: [],
    events: [],
  },
  "genai-monthly-meetup": {
    id: "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c01",
    slug: "genai-monthly-meetup",
    name: "GenAI Monthly Meetup",
    type: "event_series",
    partnerName: null,
    summary: null,
    about: null,
    coverFileId: null,
    phase: "upcoming",
    status: "draft",
    startsOn: null,
    endsOn: null,
    pageKind: "standard",
    externalUrl: null,
    keyDates: [],
    events: [],
  },
};

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer((request, response) => {
  const url = new URL(request.url, "http://stub");
  const session = /BEYONDPILOT_SESSION=([a-z]+)/.exec(request.headers.cookie ?? "")?.[1];
  const account = session ? accounts[session] : undefined;

  if (url.pathname === "/api/identity/me") {
    return json(response, account ? 200 : 401, account ?? {});
  }
  if (url.pathname === "/api/usecase/admin/organizations") {
    if (account?.role !== "operator") {
      return json(response, account ? 403 : 401, {});
    }
    return json(response, 200, {
      items: [
        { id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03", name: "Pocket Policy" },
        { id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c04", name: "Tasco" },
      ],
    });
  }
  if (url.pathname === "/api/usecase/admin/use-cases") {
    if (account?.role !== "operator") {
      return json(response, account ? 403 : 401, {});
    }
    return json(response, 200, { items: [], page: 1, pageSize: 25, total: 0 });
  }
  if (url.pathname === "/api/identity/accounts") {
    if (account?.role !== "operator") {
      return json(response, account ? 403 : 401, {});
    }
    const text = (url.searchParams.get("q") ?? "").toLowerCase();
    const status = url.searchParams.get("status");
    const role = url.searchParams.get("role");
    const items = listed.filter(
      (item) =>
        (!text ||
          item.email.toLowerCase().includes(text) ||
          (item.displayName ?? "").toLowerCase().includes(text)) &&
        (!status || item.status === status) &&
        (!role || item.role === role),
    );
    // A search for "example" is answered two to a page, so a test can walk pages with five accounts.
    const pageSize = text === "example" ? 2 : 25;
    const page = Number(url.searchParams.get("page") ?? 1);
    return json(response, 200, {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: items.length,
    });
  }
  if (url.pathname === "/api/audit/events") {
    if (account?.role !== "operator") {
      return json(response, account ? 403 : 401, {});
    }
    const text = (url.searchParams.get("q") ?? "").toLowerCase();
    const action = url.searchParams.get("action");
    const from = url.searchParams.get("from");
    const matching = events.filter(
      (event) =>
        (!text ||
          event.resource.label.toLowerCase().includes(text) ||
          (event.actor?.label ?? "").toLowerCase().includes(text) ||
          (event.actor?.email ?? "").toLowerCase().includes(text)) &&
        (!action || event.action === action) &&
        (!from || event.occurredAt >= from),
    );
    // A search for "example" is answered two to a page, so a test can walk pages. A cursor here is
    // the identifier of the event at the page's edge.
    const pageSize = text === "example" ? 2 : 50;
    const before = url.searchParams.get("before");
    const after = url.searchParams.get("after");
    if ([before, after].some((cursor) => cursor && !events.some((event) => event.id === cursor))) {
      return json(response, 400, {});
    }
    const place = (cursor) => matching.findIndex((event) => event.id === cursor);
    const start = before ? place(before) + 1 : after ? Math.max(0, place(after) - pageSize) : 0;
    const items = matching.slice(start, after ? place(after) : start + pageSize);
    return json(response, 200, {
      items,
      newer: items.length > 0 && start > 0 ? items[0].id : null,
      older: items.length > 0 && start + items.length < matching.length ? items.at(-1).id : null,
    });
  }
  const record =
    answerJudging(url, account) ??
    answerApplication(url, account ? session : undefined, account?.email) ??
    answerReview(url, account) ??
    answerWorkspace(url, account ? session : undefined) ??
    answerEmail(url, account) ??
    answerDirectory(url);
  if (record) {
    return json(response, ...record);
  }
  const administered = answerSearchAdmin(url, account);
  if (administered) {
    return json(response, ...administered);
  }
  const searched = answerSearch(url);
  if (searched) {
    return json(response, ...searched);
  }
  if (url.pathname === "/api/program/programs") {
    const items = Object.values(publicPrograms)
      .filter((program) => program.status === "published")
      .map((program) => ({
        slug: program.slug,
        name: program.name,
        type: program.type,
        partnerName: program.partnerName,
        summary: program.summary,
        coverFileId: program.coverFileId,
        phase: program.phase,
        startsOn: program.startsOn,
        endsOn: program.endsOn,
        pageKind: program.pageKind,
        externalUrl: program.externalUrl,
        applications: program.applications,
        upcomingEvents: program.events.filter(
          (event) => event.startsAt >= new Date().toISOString(),
        ),
      }));
    return json(response, 200, { items });
  }
  if (url.pathname.startsWith("/api/program/programs/")) {
    const program = publicPrograms[url.pathname.split("/")[4]];
    // A draft is read by an operator only, as the backend answers it.
    if (!program || (program.status === "draft" && account?.role !== "operator")) {
      return json(response, 404, { status: 404, code: "PROGRAM_NOT_FOUND" });
    }
    return json(response, 200, program);
  }
  if (url.pathname.startsWith("/api/program/admin/programs")) {
    if (account?.role !== "operator") {
      return json(response, account ? 403 : 401, {});
    }
    const id = url.pathname.split("/")[5];
    if (id && url.pathname.endsWith("/questions")) {
      const program = programs[id];
      if (!program) {
        return json(response, 404, {});
      }
      // The Tasco challenge's applications are open, which fixes its questions.
      const opensAt = program.applications?.opensAt ?? null;
      return json(response, 200, {
        questions:
          program.slug === "insurance-ai-tasco"
            ? [
                {
                  id: "5f0c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e01",
                  kind: "single_choice",
                  label: "Direction",
                  help: null,
                  required: true,
                  options: ["Buying", "Carrying", "Claiming"],
                  maxLength: null,
                },
              ]
            : [],
        fixed: opensAt !== null && Date.parse(opensAt) <= Date.now(),
        opensAt,
        version: program.version,
      });
    }
    if (id) {
      return programs[id] ? json(response, 200, programs[id]) : json(response, 404, {});
    }
    return json(response, 200, {
      items: Object.values(programs).map((program) => ({
        id: program.id,
        slug: program.slug,
        name: program.name,
        type: program.type,
        partnerName: program.partnerName,
        status: program.status,
        phase: program.status === "draft" ? "upcoming" : "open",
        applications: program.applications,
        startsOn: program.startsOn,
        endsOn: program.endsOn,
        updatedAt: program.updatedAt,
      })),
    });
  }
  response.writeHead(url.pathname === "/health" ? 200 : 404).end();
}).listen(Number(process.env.STUB_BACKEND_PORT));
