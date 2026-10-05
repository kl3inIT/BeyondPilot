"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";
import { useVocabulary } from "@/i18n/vocabulary";

import { reviewedStatuses } from "./solution-codes";
import { SolutionsFilters } from "./solutions-filters";
import { adminSolutionsSearch } from "./solutions-search";

type SolutionsToolbarProps =
  | {
      list: "directory";
      /** How much of the list shows, already worded; absent when nothing matches. */
      count: string | null;
    }
  | { list: "admin" };

/** Search and filters of a list of solutions: the public directory's facets, or the operators' status. */
function SolutionsToolbar(props: SolutionsToolbarProps) {
  const t = useTranslations("Solution.filters");
  const status = useVocabulary("reviewStatus");

  if (props.list === "directory") {
    return <SolutionsFilters count={props.count} />;
  }

  return (
    <FilterToolbar
      parsers={adminSolutionsSearch}
      searchLabel={t("adminSearch")}
      clearLabel={t("clear")}
      filters={[
        {
          key: "status",
          label: t("status.label"),
          all: t("status.all"),
          options: reviewedStatuses.map((value) => ({ value, label: status(value) })),
        },
      ]}
    />
  );
}

export { SolutionsToolbar };
