import { cookies } from "next/headers";

import type { Me } from "@/lib/api/generated";

/**
 * The signed-in account of the current request, or `null`. Server only: it forwards the browser's
 * cookies to the backend, which owns the session. The answer is never cached, and anything other
 * than a 200 (no session, a disabled account, a backend that is unreachable or silent for three
 * seconds) counts as signed out.
 */
export async function getCurrentAccount(): Promise<Me | null> {
  const apiOrigin = process.env.BEYONDPILOT_API_ORIGIN;
  const cookieHeader = (await cookies()).toString();
  if (!apiOrigin || !cookieHeader) {
    return null;
  }
  try {
    const response = await fetch(`${apiOrigin}/api/identity/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok ? ((await response.json()) as Me) : null;
  } catch {
    return null;
  }
}
