import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppConsent } from "@/features/identity/app-consent";
import { getConnectingApp } from "@/lib/api/generated";
import { requireAccount, sessionRequest } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/oauth-consent">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AppConsent" });

  return { title: t("metaTitle"), robots: { index: false } };
}

/**
 * Where Spring's authorization server sends a signed-in person to allow an AI app. The address
 * names the app, the scopes it asked for and the state that ties the answer to the request.
 */
export default async function AppConsentRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/oauth-consent">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { client_id: clientId, scope, state } = await searchParams;
  if (typeof clientId !== "string" || typeof scope !== "string" || typeof state !== "string") {
    notFound();
  }
  // The server sends only a signed-in person here. A session that has ended since cannot resume
  // the request, so the person signs in and connects again from the app.
  const account = await requireAccount(siteRoutes.home);
  const { data: app } = await getConnectingApp({
    ...(await sessionRequest()),
    query: { clientId },
    throwOnError: false,
  });
  if (!app) {
    notFound();
  }

  return (
    <AppConsent
      app={app}
      account={account}
      scopes={scope.split(" ").filter(Boolean)}
      state={state}
    />
  );
}
