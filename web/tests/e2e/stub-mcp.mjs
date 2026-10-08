// The AI apps a person connected to BeyondPilot's MCP server (BEY-78): the operator has two, everyone
// else none. A revoke is a request from the browser, which each test answers itself.

const connected = {
  operator: [
    {
      id: "0d6c1b9e-7f2a-3c41-9a8e-111111111111",
      clientId: "https://chatgpt.com/oauth/client.json",
      name: "ChatGPT",
      host: "chatgpt.com",
      reviewed: true,
      servers: ["user"],
      allowedAt: "2026-10-07T02:00:00Z",
      usedAt: "2026-10-07T06:00:00Z",
    },
    {
      id: "0d6c1b9e-7f2a-3c41-9a8e-222222222222",
      clientId: "https://claude.ai/oauth/mcp-oauth-client-metadata",
      name: "Claude",
      host: "claude.ai",
      reviewed: true,
      servers: ["user"],
      allowedAt: "2026-10-06T02:00:00Z",
      usedAt: "2026-10-06T09:00:00Z",
    },
  ],
};

// What Admin › AI › MCP reads: both servers with their tools, and the reviewed app hosts.
const settings = {
  operatorServerAddress: "https://beyondpilot.test/mcp/operator",
  userServerAddress: "https://beyondpilot.test/mcp",
  userServerEnabled: true,
  tools: [
    { server: "operator", name: "search", title: "Search", description: null, enabled: true },
    { server: "operator", name: "fetch", title: "Fetch", description: null, enabled: true },
    { server: "user", name: "search", title: "Search", description: null, enabled: true },
    { server: "user", name: "fetch", title: "Fetch", description: null, enabled: false },
  ],
};

const hosts = {
  allowOtherHosts: true,
  hosts: [
    { host: "chatgpt.com", apps: ["ChatGPT"] },
    { host: "claude.ai", apps: ["Claude"] },
    { host: "zed.dev", apps: [] },
  ],
};

// Every person's connections, and two calls, as Admin › AI › MCP shows them.
const everyConnection = [
  {
    accountId: "5b1f2c3d-0000-4000-8000-000000000001",
    personName: "Minh Tran",
    personEmail: "minh@startup.vn",
    operator: false,
    id: "0d6c1b9e-7f2a-3c41-9a8e-111111111111",
    clientId: "https://chatgpt.com/oauth/client.json",
    name: "ChatGPT",
    host: "chatgpt.com",
    reviewed: true,
    servers: ["user"],
    allowedAt: "2026-10-05T02:00:00Z",
    usedAt: "2026-10-07T06:00:00Z",
  },
  {
    accountId: "5b1f2c3d-0000-4000-8000-000000000002",
    personName: "Đạt Phan",
    personEmail: "dat.phan@example.com",
    operator: true,
    id: "0d6c1b9e-7f2a-3c41-9a8e-222222222222",
    clientId: "https://claude.ai/oauth/claude-code-client-metadata",
    name: "Claude Code",
    host: "claude.ai",
    reviewed: true,
    servers: ["operator"],
    allowedAt: "2026-10-06T02:00:00Z",
    usedAt: "2026-10-07T05:00:00Z",
  },
];

const calls = {
  items: [
    {
      calledAt: "2026-10-07T07:32:00Z",
      accountId: "5b1f2c3d-0000-4000-8000-000000000002",
      personName: "Đạt Phan",
      personEmail: "dat.phan@example.com",
      clientId: "https://claude.ai/oauth/claude-code-client-metadata",
      appName: "Claude Code",
      appHost: "claude.ai",
      server: "operator",
      tool: "search",
      outcome: "ok",
      durationMs: 41,
    },
    {
      calledAt: "2026-10-07T07:31:00Z",
      accountId: "5b1f2c3d-0000-4000-8000-000000000001",
      personName: "Minh Tran",
      personEmail: "minh@startup.vn",
      clientId: "https://chatgpt.com/oauth/client.json",
      appName: "ChatGPT",
      appHost: "chatgpt.com",
      server: "user",
      tool: "fetch",
      outcome: "refused",
      durationMs: 12,
    },
  ],
  page: 1,
  pageSize: 50,
  total: 2,
  apps: [
    { clientId: "https://chatgpt.com/oauth/client.json", name: "ChatGPT", host: "chatgpt.com" },
    {
      clientId: "https://claude.ai/oauth/claude-code-client-metadata",
      name: "Claude Code",
      host: "claude.ai",
    },
  ],
  tools: ["search", "fetch"],
};

export function answerMcp(url, session) {
  if (url.pathname === "/api/identity/apps") {
    return session ? [200, connected[session] ?? []] : [401, {}];
  }
  if (url.pathname === "/api/mcp/admin/settings") {
    return session === "operator" ? [200, settings] : [403, {}];
  }
  if (url.pathname === "/api/identity/admin/apps") {
    return session === "operator" ? [200, everyConnection] : [403, {}];
  }
  if (url.pathname === "/api/mcp/admin/calls") {
    return session === "operator" ? [200, calls] : [403, {}];
  }
  if (url.pathname === "/api/identity/admin/app-hosts") {
    return session === "operator" ? [200, hosts] : [403, {}];
  }
  return null;
}
