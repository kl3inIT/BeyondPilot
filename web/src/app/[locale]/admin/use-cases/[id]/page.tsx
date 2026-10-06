import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminUseCasePage } from "@/features/usecase/admin-use-case-page";
import { readAdminUseCase } from "@/features/usecase/admin-use-case-queries";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/use-cases/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.useCases.detail" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminUseCaseRoute({
  params,
}: PageProps<"/[locale]/admin/use-cases/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", `${siteRoutes.adminUseCases}/${id}`);
  const useCase = await readAdminUseCase(id).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });
  if (!useCase) {
    notFound();
  }

  return <AdminUseCasePage useCase={useCase} />;
}
