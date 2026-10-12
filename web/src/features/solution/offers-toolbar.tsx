"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";

import { adminOffersSearch, offerStates } from "./offers-search";

/** Search and the state filter above the operators' list of offers. */
function OffersToolbar() {
  const t = useTranslations("Admin.offers.filters");
  const state = useTranslations("Solution.offers.state");
  const common = useTranslations("Solution.filters");

  return (
    <FilterToolbar
      parsers={adminOffersSearch}
      resets={[]}
      searchLabel={t("search")}
      clearLabel={common("clear")}
      filters={[
        {
          key: "state",
          label: t("state.label"),
          all: t("state.all"),
          options: offerStates.map((value) => ({ value, label: state(value) })),
        },
      ]}
    />
  );
}

export { OffersToolbar };
