import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthBackLink } from "@/features/identity/auth-back-link";
import { SignInForm } from "@/features/identity/sign-in-form";
import { getPathname } from "@/i18n/navigation";
import { getCurrentAccount } from "@/lib/auth/session";
import { localPath } from "@/lib/return-to";
import { siteRoutes } from "@/lib/site";
import { redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SignIn" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function SignInRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { returnTo: requested, error } = await searchParams;
  const returnTo = localPath(typeof requested === "string" ? requested : undefined);

  // Someone already signed in has nothing to do here.
  if (await getCurrentAccount()) {
    redirect(returnTo ?? getPathname({ href: siteRoutes.home, locale }));
  }

  return (
    <>
      <AuthBackLink />
      <SignInForm returnTo={returnTo} error={typeof error === "string" ? error : undefined} />
    </>
  );
}
