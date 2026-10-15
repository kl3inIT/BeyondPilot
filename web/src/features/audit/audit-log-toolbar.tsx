"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";

import { auditActionGroups, auditLogSearch, auditPeriods } from "./audit-log-search";

/**
 * Search, the period and the action filter of the audit log. The log is paged by cursor, so a change
 * drops `before` and `after` and returns to the newest events.
 */
function AuditLogToolbar() {
  const t = useTranslations("Admin.auditLog");
  const nav = useTranslations("Admin.nav");

  return (
    <FilterToolbar
      parsers={auditLogSearch}
      resets={["before", "after"]}
      searchLabel={t("search")}
      clearLabel={t("clear")}
      filters={[
        {
          key: "period",
          label: t("filters.period.label"),
          options: auditPeriods.map((value) => ({ value, label: t(`period.${value}`) })),
        },
        {
          key: "action",
          label: t("filters.action.label"),
          all: t("filters.action.all"),
          searchable: {
            placeholder: t("filters.action.search"),
            empty: t("filters.action.empty"),
          },
          // The actions are read by area, the areas named and ordered as the sidebar has them.
          options: auditActionGroups.map((group) => ({
            label: nav(group.area),
            options: group.actions.map((value) => ({ value, label: t(`action.${value}`) })),
          })),
        },
      ]}
    />
  );
}

export { AuditLogToolbar };
