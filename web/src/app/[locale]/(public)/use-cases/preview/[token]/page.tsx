import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { UseCasePage } from "@/features/usecase/use-case-page";
import { readPreviewedUseCase } from "@/features/usecase/use-cases-queries";

/** A link someone shared is not for search engines to list. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PreviewedUseCaseRoute({
  params,
}: PageProps<"/[locale]/use-cases/preview/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const useCase = await readPreviewedUseCase(token);
  if (!useCase) {
    notFound();
  }

  return <UseCasePage useCase={useCase} preview />;
}
