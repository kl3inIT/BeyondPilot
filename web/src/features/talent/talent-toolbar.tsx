"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";
import { useVocabulary } from "@/i18n/vocabulary";

import { featuredChoices, reviewedStatuses } from "./talent-codes";
import { adminTalentSearch } from "./talent-search";

/** Search, the status filter and the featured filter of the operators' list of talent profiles. */
function TalentToolbar() {
  const t = useTranslations("Talent.filters");
  const status = useVocabulary("talentStatus");

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
        {
          key: "featured",
          label: t("featured.label"),
          all: t("featured.all"),
          options: featuredChoices.map((value) => ({
            value,
            label: t(value === "true" ? "featured.yes" : "featured.no"),
          })),
        },
      ]}
    />
  );
}

export { TalentToolbar };
