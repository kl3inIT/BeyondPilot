"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";
import { useVocabulary } from "@/i18n/vocabulary";

import { reviewedStatuses } from "./talent-codes";
import { adminTalentSearch } from "./talent-search";

/** Search and the status filter of the operators' list of talent profiles. */
function TalentToolbar() {
  const t = useTranslations("Talent.filters");
  const status = useVocabulary("reviewStatus");

  return (
    <FilterToolbar
      parsers={adminTalentSearch}
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

export { TalentToolbar };
