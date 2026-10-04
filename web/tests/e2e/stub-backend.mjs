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
  response.writeHead(url.pathname === "/health" ? 200 : 404).end();
}).listen(Number(process.env.STUB_BACKEND_PORT));
