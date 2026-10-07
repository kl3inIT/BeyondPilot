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

export function answerMcp(url, session) {
  if (url.pathname === "/api/identity/apps") {
    return session ? [200, connected[session] ?? []] : [401, {}];
  }
  return null;
}
