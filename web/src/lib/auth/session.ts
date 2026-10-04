import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { cache } from "react";

import { getPathname } from "@/i18n/navigation";
import { getMe, type Me } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

/**
 * What a server-side call to the backend carries so that it is made as the person behind this
 * request: their cookies, and no caching, because what one person may read is never kept for
 * another. Server only.
 */
export async function sessionRequest() {
  return { headers: { cookie: (await cookies()).toString() }, cache: "no-store" as const };
}

/**
 * The signed-in account of the current request, or `null`. Server only: it forwards the browser's
 * cookies to the backend, which owns the session. The answer is never cached across requests, and
 * any failure (no session, a disabled account, a backend that is unreachable or
 * silent for three seconds) counts as signed out. Within one request the backend is asked once,
 * however many components call this.
 */
export const getCurrentAccount = cache(async (): Promise<Me | null> => {
  const request = await sessionRequest();
  if (!request.headers.cookie) {
    return null;
  }
  try {
    const { data } = await getMe({ ...request, signal: AbortSignal.timeout(3000) });
    return data;
  } catch {
    return null;
  }
});

/**
 * The signed-in account, for a page nobody may see signed out. A visitor is sent to sign in and
 * comes back to `returnTo`, the page's route without its locale prefix. A page calls this itself:
 * a layout is not rendered again when a person moves between its pages, so a check placed there
 * is skipped.
 */
export async function requireAccount(returnTo: string): Promise<Me> {
  const account = await getCurrentAccount();
  if (account) {
    return account;
  }
  const locale = await getLocale();
  redirect(
    getPathname({
      href: {
        pathname: siteRoutes.signIn,
        query: { returnTo: getPathname({ href: returnTo, locale }) },
      },
      locale,
    }),
  );
}

/**
 * The signed-in account, for a page of one role only. An account of another role gets the
 * not-found page, so the page is not given away to those who cannot open it. This keeps the page
 * from rendering; what the account may read or change is decided by the backend on every request.
 */
export async function requireRole(role: Me["role"], returnTo: string): Promise<Me> {
  const account = await requireAccount(returnTo);
  if (account.role !== role) {
    notFound();
  }
  return account;
}
