import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readAdminPerks } from "@/features/perk/perk-queries";
import { AdminPerksPage } from "@/features/perk/perk-record";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/solutions/perks">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Perk.manage" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminPerksRoute({
  params,
}: PageProps<"/[locale]/admin/solutions/perks">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminPerks);
  const perks = await readAdminPerks().catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AdminPerksPage perks={perks} />;
}
