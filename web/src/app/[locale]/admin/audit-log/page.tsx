import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { AuditLogPage } from "@/features/audit/audit-log-page";
import { readAuditLog } from "@/features/audit/audit-log-queries";
import { auditLogSearch, loadAuditLogSearch } from "@/features/audit/audit-log-search";
import { getPathname } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

const address = createSerializer(auditLogSearch);

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/audit-log">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.auditLog" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AuditLogRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/audit-log">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminAuditLog);
  const search = await loadAuditLogSearch(searchParams);
  const paged = search.before !== null || search.after !== null;
  const events = await readAuditLog(search).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    // A cursor from a hand-edited address is not one; the newest events are the page to show.
    if (error instanceof ApiError && error.status === 400 && paged) {
      return null;
    }
    throw error;
  });
  // A page beyond either end holds nothing and names no neighbour, so it would be a dead end.
  if (events === null || (paged && events.items.length === 0)) {
    redirect(
      getPathname({
        href: address(siteRoutes.adminAuditLog, { ...search, before: null, after: null }),
        locale,
      }),
    );
  }

  return <AuditLogPage events={events} search={search} />;
}
