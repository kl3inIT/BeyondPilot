import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { PerkPage } from "@/features/perk/perk-page";
import { readPerk } from "@/features/perk/perk-queries";
import { getPathname } from "@/i18n/navigation";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/solutions/perks/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await readPerk(slug);

  return page
    ? { title: page.card.title + titleSuffix, description: page.card.summary ?? undefined }
    : { robots: { index: false } };
}

export default async function PerkRoute({ params }: PageProps<"/[locale]/solutions/perks/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = await readPerk(slug);
  if (!page) {
    notFound();
  }
  const returnTo = getPathname({ href: `${siteRoutes.perks}/${slug}`, locale });

  return (
    <PerkPage
      page={page}
      signInHref={`${siteRoutes.signIn}?${new URLSearchParams({ returnTo })}`}
    />
  );
}
