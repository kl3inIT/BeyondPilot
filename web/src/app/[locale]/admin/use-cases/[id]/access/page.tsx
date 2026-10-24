import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readProposalCounts } from "@/features/proposal/received-queries";
import {
  readAdminUseCase,
  readAdminUseCaseAccess,
  readAdminUseCasePreview,
} from "@/features/usecase/admin-use-case-queries";
import { AdminUseCaseAccessPage } from "@/features/usecase/use-case-access-page";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { adminUseCaseAccessRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/use-cases/[id]/access">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Organization.useCases.access" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminUseCaseAccessRoute({
  params,
}: PageProps<"/[locale]/admin/use-cases/[id]/access">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminUseCaseAccessRoute(id));
  const gone = (error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  };
  const [useCase, access] = await Promise.all([
    readAdminUseCase(id).catch(gone),
    readAdminUseCaseAccess(id).catch(gone),
  ]);
  if (!useCase || !access) {
    notFound();
  }
  const preview =
    useCase.status === "approved" ? null : await readAdminUseCasePreview(id).catch(gone);
  const proposals = useCase.publishedAt ? await readProposalCounts([id]).catch(() => null) : null;

  return (
    <AdminUseCaseAccessPage
      useCase={useCase}
      access={access}
      preview={preview}
      proposals={proposals?.get(id)}
    />
  );
}
