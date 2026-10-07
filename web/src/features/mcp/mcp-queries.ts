import { headers } from "next/headers";

import {
  getAppHosts,
  getMcpSettings,
  listConnectedApps,
  listEveryConnectedApp,
  listMcpCalls,
  type AppHosts,
  type ConnectedApp,
  type McpCallList,
  type McpSettings,
  type PersonConnectedApp,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import type { McpActivitySearch } from "./admin-mcp-search";

/** The AI apps the person behind this request connected, the latest used first. Server only. */
export async function readConnectedApps(): Promise<ConnectedApp[]> {
  const { data } = await listConnectedApps(await sessionRequest());
  return data;
}

/**
 * The address of the MCP server every signed-in person may use, on the host this page was asked
 * for: the proxy passes the browser's host and scheme on. Server only.
 */
export async function userServerAddress(): Promise<string> {
  const request = await headers();
  const host = request.get("x-forwarded-host") ?? request.get("host") ?? "localhost:3000";
  const scheme =
    request.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${scheme}://${host}/mcp`;
}

/** The MCP servers, their switches and their tools, for Admin › AI › MCP. Server only. */
export async function readMcpSettings(): Promise<McpSettings> {
  const { data } = await getMcpSettings(await sessionRequest());
  return data;
}

/** The reviewed app hosts and whether apps of other hosts may connect. Server only. */
export async function readAppHosts(): Promise<AppHosts> {
  const { data } = await getAppHosts(await sessionRequest());
  return data;
}

/** Every person's connected apps, for Admin › AI › MCP › Connected apps. Server only. */
export async function readEveryConnection(): Promise<PersonConnectedApp[]> {
  const { data } = await listEveryConnectedApp(await sessionRequest());
  return data;
}

const DAY = 24 * 60 * 60 * 1000;

const periodLength = { day: DAY, week: 7 * DAY, month: 30 * DAY, all: null };

/**
 * One page of the calls AI apps made, for Admin › AI › MCP › Activity. Server only. The backend
 * knows instants, not periods, so the period becomes the instant it starts at.
 */
export async function readMcpCalls(search: McpActivitySearch): Promise<McpCallList> {
  const length = periodLength[search.period];
  const { data } = await listMcpCalls({
    ...(await sessionRequest()),
    query: {
      from: length === null ? undefined : new Date(Date.now() - length).toISOString(),
      app: search.app ?? undefined,
      tool: search.tool ?? undefined,
      outcome: search.outcome ?? undefined,
      q: search.q.trim().slice(0, 100) || undefined,
      page: search.page > 1 ? search.page : undefined,
    },
  });
  return data;
}
