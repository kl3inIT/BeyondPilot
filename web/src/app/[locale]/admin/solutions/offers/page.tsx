import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminOffersPage } from "@/features/solution/admin-offers-page";
import { loadAdminOffersSearch } from "@/features/solution/offers-search";
import { readAdminOffers } from "@/features/solution/solution-queries";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/solutions/offers">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.offers" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminOffersRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/solutions/offers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminOffers);
  const search = await loadAdminOffersSearch(searchParams);
  const offers = await readAdminOffers().catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AdminOffersPage offers={offers} search={search} />;
}
