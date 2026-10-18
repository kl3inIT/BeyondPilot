import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminOfferPage } from "@/features/solution/admin-offer-page";
import { readAdminOffer } from "@/features/solution/solution-queries";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/solutions/offers/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.offers" });

  // Several records open side by side are told apart by their tabs. Anyone but an operator gets no name.
  const record = await readAdminOffer(id).catch(() => null);

  return {
    title: record ? record.offer.title + titleSuffix : t("metaTitle"),
    robots: { index: false },
  };
}

export default async function AdminOfferRoute({
  params,
}: PageProps<"/[locale]/admin/solutions/offers/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", `${siteRoutes.adminOffers}/${id}`);
  const detail = await readAdminOffer(id);
  if (!detail) {
    notFound();
  }

  return <AdminOfferPage detail={detail} />;
}
