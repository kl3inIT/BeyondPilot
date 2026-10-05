import { useTranslations } from "next-intl";

import { DataTableFooter } from "@/components/composites/data-table";

type ListFooterProps = {
  /** How many records match, already worded: "8 solutions". */
  count: string;
  page: number;
  pageSize: number;
  total: number;
  /** The address of a page, already carrying the search and filters. */
  href: (page: number) => string;
};

/** The footer of a paged list with the wording every list shares for its paging. */
function ListFooter({ count, page, pageSize, total, href }: ListFooterProps) {
  const t = useTranslations("Lists.pagination");

  return (
    <DataTableFooter
      count={count}
      page={page}
      pages={Math.max(1, Math.ceil(total / pageSize))}
      href={href}
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
