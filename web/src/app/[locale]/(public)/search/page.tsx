import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SearchPage } from "@/features/search/search-page";
import { loadSearchParams } from "@/features/search/search-params";
import { readSearch } from "@/features/search/search-queries";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await params;
  const { q } = await loadSearchParams(searchParams);
  const t = await getTranslations({ locale, namespace: "Search" });
  const query = q.trim();

  // A page of results is not a page for search engines to keep.
  return {
    title: query ? t("metaTitleFor", { q: query }) : t("metaTitle"),
    robots: { index: false, follow: true },
  };
}

export default async function SearchRoute({ params, searchParams }: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await loadSearchParams(searchParams);

  return <SearchPage params={search} results={await readSearch(search)} />;
}
