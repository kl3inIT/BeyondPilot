import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { TalentProfilePage } from "@/features/talent/talent-profile-page";
import { readMyTalent, readTalentProfile } from "@/features/talent/talent-queries";
import { getPathname } from "@/i18n/navigation";
import { getCurrentAccount } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/talent/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const profile = await readTalentProfile(slug);

  return profile
    ? { title: profile.name + titleSuffix, description: profile.headline ?? undefined }
    : { robots: { index: false } };
}

export default async function TalentProfileRoute({ params }: PageProps<"/[locale]/talent/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [profile, account] = await Promise.all([readTalentProfile(slug), getCurrentAccount()]);
  if (!profile) {
    notFound();
  }
  // A visitor signs in first and comes back to this profile to write.
  const returnTo = getPathname({ href: `${siteRoutes.talent}/${profile.slug}`, locale });
  const signInHref = account
    ? undefined
    : `${siteRoutes.signIn}?${new URLSearchParams({ returnTo })}`;

  const own = account ? (await readMyTalent()).profile?.slug === profile.slug : false;

  return <TalentProfilePage profile={profile} signInHref={signInHref} own={own} />;
}
