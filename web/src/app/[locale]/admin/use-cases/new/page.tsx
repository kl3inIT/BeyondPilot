import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminUseCaseForm } from "@/features/usecase/admin-use-case-form";
import { readUseCaseOrganizations } from "@/features/usecase/admin-use-case-queries";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/use-cases/new">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.useCases.form" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function NewAdminUseCaseRoute({
  params,
}: PageProps<"/[locale]/admin/use-cases/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminUseCasesNew);
  const organizations = await readUseCaseOrganizations().catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AdminUseCaseForm organizations={organizations} />;
}
