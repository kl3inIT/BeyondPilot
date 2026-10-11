"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";
import { useCountryName } from "@/i18n/vocabulary";

import { adminOrganizationsSearch } from "./admin-organizations-search";
import { organizationStatuses } from "./organization-codes";

type AdminOrganizationsToolbarProps = {
  /** The countries organizations are in, by ISO 3166-1 alpha-2 code. */
  countries: string[];
};

/** Search and the status and country filters of the operators' list of organizations. */
function AdminOrganizationsToolbar({ countries }: AdminOrganizationsToolbarProps) {
  const t = useTranslations("Admin.organizations");
  const countryName = useCountryName();

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
        {
          key: "country",
          label: t("filters.country.label"),
          all: t("filters.country.all"),
          options: countries
            .map((value) => ({ value, label: countryName(value) }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        },
      ]}
    />
  );
}

export { AdminOrganizationsToolbar };
