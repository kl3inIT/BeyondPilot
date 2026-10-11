"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";

import { accountsSearch } from "./accounts-search";

/** Search, the status filter and the role filter of the accounts list. */
function AccountsToolbar() {
  const t = useTranslations("Admin.accounts");

  return (
    <FilterToolbar
      parsers={accountsSearch}
      searchLabel={t("search")}
      clearLabel={t("clear")}
      filters={[
        {
          key: "status",
          label: t("filters.status.label"),
          all: t("filters.status.all"),
          options: [
            { value: "active", label: t("status.active") },
            { value: "disabled", label: t("status.disabled") },
          ],
        },
        {
          key: "role",
          label: t("filters.role.label"),
          all: t("filters.role.all"),
          options: [
            { value: "user", label: t("role.user") },
            { value: "operator", label: t("role.operator") },
          ],
        },
      ]}
    />
  );
}

export { AccountsToolbar };
