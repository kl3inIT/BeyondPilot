import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminProgramAssignmentsPage } from "@/features/messaging/admin-program-assignments-page";
import { listAccounts, listProgramConversationAssignments } from "@/lib/api/generated";
import { requireRole, sessionRequest } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/messages/programs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Messaging.assignments" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ProgramMessagesRoute({
  params,
}: PageProps<"/[locale]/admin/messages/programs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminProgramMessages);
  const options = await sessionRequest();
  const [assignments, operators] = await Promise.all([
    listProgramConversationAssignments(options),
    listAccounts({ ...options, query: { role: "operator", status: "active", size: 100 } }),
  ]);
  return (
    <AdminProgramAssignmentsPage assignments={assignments.data} operators={operators.data.items} />
  );
}
