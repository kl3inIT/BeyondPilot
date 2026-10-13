import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { contactRoute } from "@/features/messaging/messaging-search";
import { TalentProfilePage } from "@/features/talent/talent-profile-page";
import { readMyTalent, readTalentProfile } from "@/features/talent/talent-queries";
import { getCurrentAccount } from "@/lib/auth/session";
import { titleSuffix } from "@/lib/site";

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
  const own = account ? (await readMyTalent()).profile?.slug === profile.slug : false;

  return (
    <TalentProfilePage
      profile={profile}
      // Contact leads to Messages; a visitor signs in first and comes back to the first message.
      contactHref={contactRoute({ kind: "talent", slug: profile.slug }, !!account, locale)}
      visitor={!account}
      own={own}
    />
  );
}
