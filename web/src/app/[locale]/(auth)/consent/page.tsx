import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ConsentStep } from "@/features/identity/consent-step";
import { getPathname } from "@/i18n/navigation";
import { getMyConsent } from "@/lib/api/generated";
import { getCurrentAccount, sessionRequest } from "@/lib/auth/session";
import { localPath } from "@/lib/return-to";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/consent">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Consent" });

  return { title: t("metaTitle"), robots: { index: false } };
}

/**
 * Where every page sends a signed-in person who has not agreed to use the platform under the
 * current consent text (BEY-240). Someone who has agreed goes on to where they were going.
 */
export default async function ConsentRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/consent">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { returnTo: requested } = await searchParams;
  const home = getPathname({ href: siteRoutes.home, locale });
  const next = localPath(typeof requested === "string" ? requested : undefined) ?? home;

  // Not requireAccount: it sends a person without consent here, which would never end.
  if (!(await getCurrentAccount())) {
    redirect(
      getPathname({
        href: {
          pathname: siteRoutes.signIn,
          query: { returnTo: getPathname({ href: siteRoutes.consent, locale }) },
        },
        locale,
      }),
    );
  }
  const { data: consent } = await getMyConsent(await sessionRequest());
  if (!consent.needed) {
    redirect(next);
  }

  return <ConsentStep consent={consent} next={next} home={home} />;
}
