"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";

import { adminIntroductionsSearch, introductionStatuses } from "./admin-introductions-search";

/** Search and the state filter of the operators' list of requests for an introduction. */
function AdminIntroductionsToolbar() {
  const t = useTranslations("Admin.introductions");

  return (
    <FilterToolbar
      parsers={adminIntroductionsSearch}
      searchLabel={t("search")}
      clearLabel={t("clear")}
      filters={[
        {
          key: "status",
          label: t("filter.label"),
          all: t("filter.all"),
          options: introductionStatuses.map((value) => ({ value, label: t(`status.${value}`) })),
        },
      ]}
    />
  );
}

export { AdminIntroductionsToolbar };
