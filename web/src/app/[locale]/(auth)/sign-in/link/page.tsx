import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SignInLinkPage } from "@/features/identity/sign-in-link-page";
import { getPathname } from "@/i18n/navigation";
import { localPath } from "@/lib/return-to";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in/link">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SignIn" });

  // The address carries a sign-in token: it must never be indexed or sent on as a referrer.
  return { title: t("metaTitle"), robots: { index: false }, referrer: "no-referrer" };
}

export default async function SignInLinkRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/sign-in/link">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token, returnTo } = await searchParams;

  return (
    <SignInLinkPage
      token={typeof token === "string" ? token : undefined}
      returnTo={localPath(typeof returnTo === "string" ? returnTo : undefined)}
      home={getPathname({ href: siteRoutes.home, locale })}
    />
  );
}
