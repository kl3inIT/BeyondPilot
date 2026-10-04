// Stands in for the backend where the web server itself asks it something: the session and the
// lists a page reads on the server, which a browser-side route cannot answer. The cookie's value
// picks the account, so a test signs in by setting a cookie. What the browser sends (a command, a
// sign-out) is answered by the test itself, with page.route.
import { createServer } from "node:http";

const accounts = {
  operator: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a01",
    email: "dat.phan@example.com",
    displayName: "Đạt Phan",
    role: "operator",
  },
  unnamed: {
    id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a02",
    email: "an.tran@example.com",
    displayName: null,
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
  response.writeHead(url.pathname === "/health" ? 200 : 404).end();
}).listen(Number(process.env.STUB_BACKEND_PORT));
