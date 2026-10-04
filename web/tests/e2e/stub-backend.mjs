// Stands in for the backend where the web server itself asks it something: the header reads the
// session on the server, which a browser-side route cannot answer. The cookie's value picks the
// account, so a test signs in by setting a cookie.
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

createServer((request, response) => {
  if (request.url === "/api/identity/me") {
    const session = /BEYONDPILOT_SESSION=([a-z]+)/.exec(request.headers.cookie ?? "")?.[1];
    const account = session ? accounts[session] : undefined;
    response.writeHead(account ? 200 : 401, { "Content-Type": "application/json" });
    response.end(account ? JSON.stringify(account) : "{}");
    return;
  }
  response.writeHead(request.url === "/health" ? 200 : 404).end();
}).listen(Number(process.env.STUB_BACKEND_PORT));
