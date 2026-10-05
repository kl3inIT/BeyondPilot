"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";

import { adminOrganizationsSearch } from "./admin-organizations-search";
import { organizationStatuses } from "./organization-codes";

/** Search and the status filter of the operators' list of organizations. */
function AdminOrganizationsToolbar() {
  const t = useTranslations("Admin.organizations");

  return (
    <FilterToolbar
      parsers={adminOrganizationsSearch}
      searchLabel={t("search")}
      clearLabel={t("clear")}
      filters={[
        {
          key: "status",
          label: t("filters.status.label"),
          all: t("filters.status.all"),
          options: organizationStatuses.map((value) => ({ value, label: t(`status.${value}`) })),
        },
      ]}
    />
  );
}

export { AdminOrganizationsToolbar };
