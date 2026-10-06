import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminReportedEnquiriesPage } from "@/features/talent/admin-reported-enquiries-page";
import { readReportedTalentEnquiries } from "@/features/talent/talent-queries";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/talent/reported">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.talent.reported" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminReportedEnquiriesRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/talent/reported">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminTalentReported);
  const page = Number((await searchParams).page) || 1;
  const enquiries = await readReportedTalentEnquiries(page).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AdminReportedEnquiriesPage enquiries={enquiries} />;
}
