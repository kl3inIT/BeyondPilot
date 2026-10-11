import { useTranslations } from "next-intl";

import { DataTableFooter } from "@/components/composites/data-table";
import { PageSizeSelect } from "@/components/composites/page-size-select";
import { tablePageSizes } from "@/lib/page-size";

type ListFooterProps = {
  /** How many records match, already worded: "8 solutions". */
  count: string;
  page: number;
  pageSize: number;
  total: number;
  /** The address of a page, already carrying the search, the filters and the page size. */
  href: (page: number) => string;
  /** The page sizes offered: those of a table unless the list is a grid of cards. */
  sizes?: readonly number[];
  /** A bounded search window, when the API does not serve every matching page. */
  maxPages?: number;
};

/**
 * The footer of a paged list with the wording every list shares for its paging. The page size is
 * offered once the list holds more than its smallest page.
 */
function ListFooter({
  count,
  page,
  pageSize,
  total,
  href,
  sizes = tablePageSizes,
  maxPages = Infinity,
}: ListFooterProps) {
  const t = useTranslations("Lists.pagination");

  return (
    <DataTableFooter
      count={count}
      page={page}
      pages={Math.min(maxPages, Math.max(1, Math.ceil(total / pageSize)))}
      href={href}
      sizer={<PageSizeSelect size={pageSize} sizes={sizes} total={total} />}
      labels={{
        navigation: t("label"),
        previous: t("previous"),
        next: t("next"),
        goToPrevious: t("goToPrevious"),
        goToNext: t("goToNext"),
        page: (number) => t("page", { page: number }),
      }}
    />
  );
}

export { ListFooter };
