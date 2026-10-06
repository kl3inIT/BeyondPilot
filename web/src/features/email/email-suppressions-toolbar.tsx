"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";

import { emailSuppressionsSearch, suppressionReasons } from "./email-search";

/** Search and the reason filter of the suppressed addresses. */
function EmailSuppressionsToolbar() {
  const t = useTranslations("Admin.email.suppressions");

  return (
    <FilterToolbar
      parsers={emailSuppressionsSearch}
      searchLabel={t("search")}
      clearLabel={t("clear")}
      filters={[
        {
          key: "reason",
          label: t("filters.reason.label"),
          all: t("filters.reason.all"),
          options: suppressionReasons.map((value) => ({ value, label: t(`reasons.${value}`) })),
        },
      ]}
    />
  );
}

export { EmailSuppressionsToolbar };
