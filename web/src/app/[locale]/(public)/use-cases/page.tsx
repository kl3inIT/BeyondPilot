import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { UseCasesPage } from "@/features/usecase/use-cases-page";
import { readUseCases } from "@/features/usecase/use-cases-queries";
import { loadUseCasesSearch } from "@/features/usecase/use-cases-search";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/use-cases">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "UseCases" });

  return { title: t("metaTitle"), description: t("lead") };
}

export default async function UseCasesRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/use-cases">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await loadUseCasesSearch(searchParams);

  return <UseCasesPage useCases={await readUseCases(search)} search={search} />;
}
