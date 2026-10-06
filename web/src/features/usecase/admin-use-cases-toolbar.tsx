"use client";

import { useTranslations } from "next-intl";

import type { UseCaseOrganization } from "@/lib/api/generated";
import { FilterToolbar } from "@/components/composites/filter-toolbar";

import { useCaseStatuses } from "./admin-use-case-codes";
import { adminUseCasesSearch } from "./admin-use-cases-search";

/** Search and the status filter of the operators' list of use cases. */
function AdminUseCasesToolbar({ organizations }: { organizations: UseCaseOrganization[] }) {
  const t = useTranslations("Admin.useCases");

  return (
    <FilterToolbar
      parsers={adminUseCasesSearch}
      searchLabel={t("search")}
      clearLabel={t("clear")}
      filters={[
        {
          key: "status",
          label: t("filters.status.label"),
          all: t("filters.status.all"),
          options: useCaseStatuses.map((value) => ({ value, label: t(`status.${value}`) })),
        },
        {
          key: "organization",
          label: t("filters.organization.label"),
          all: t("filters.organization.all"),
          options: organizations.map(({ id, name }) => ({ value: id, label: name })),
        },
      ]}
    />
  );
}

export { AdminUseCasesToolbar };
