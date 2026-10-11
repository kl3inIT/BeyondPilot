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
}: ListFooterProps) {
  const t = useTranslations("Lists.pagination");

  return (
    <DataTableFooter
      count={count}
      page={page}
      pages={Math.max(1, Math.ceil(total / pageSize))}
      href={href}
      sizer={total > sizes[0] && <PageSizeSelect size={pageSize} sizes={sizes} />}
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
