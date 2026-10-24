import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { UseCasePage } from "@/features/usecase/use-case-page";
import { readUseCase } from "@/features/usecase/use-cases-queries";
import { titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/use-cases/[id]">): Promise<Metadata> {
  const { id } = await params;
  const useCase = await readUseCase(id);

  return useCase
    ? { title: useCase.title + titleSuffix, description: useCase.problemStatement ?? undefined }
    : { robots: { index: false } };
}

export default async function UseCaseRoute({ params }: PageProps<"/[locale]/use-cases/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const useCase = await readUseCase(id);
  if (!useCase) {
    notFound();
  }

  return <UseCasePage useCase={useCase} />;
}
