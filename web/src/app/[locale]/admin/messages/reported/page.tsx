import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminReportedRequestsPage } from "@/features/messaging/admin-reported-requests-page";
import { readReportedRequests } from "@/features/messaging/messaging-queries";
import { loadReportedRequestsSearch } from "@/features/messaging/messaging-search";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/messages/reported">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Messaging.reported" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminReportedRequestsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/messages/reported">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminMessagesReported);
  const { page, size } = await loadReportedRequestsSearch(searchParams);
  const requests = await readReportedRequests(page, size).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AdminReportedRequestsPage requests={requests} size={size} />;
}
