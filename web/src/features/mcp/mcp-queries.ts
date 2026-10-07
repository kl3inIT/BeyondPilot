import { headers } from "next/headers";

import { listConnectedApps, type ConnectedApp } from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

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
