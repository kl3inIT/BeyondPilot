"use client";

import { useTranslations } from "next-intl";

import { FilterToolbar } from "@/components/composites/filter-toolbar";
import { useVocabulary } from "@/i18n/vocabulary";
import {
  listAdminSolutionOrganizationsWithSolutions,
  type AdminSolutionList,
} from "@/lib/api/generated";

import { deploymentChoices, industries, featuredChoices, reviewedStatuses } from "./solution-codes";
import { SolutionsFilters } from "./solutions-filters";
import { adminSolutionsSearch } from "./solutions-search";

type SolutionsToolbarProps =
  | {
      list: "directory";
      /** How much of the list shows, already worded; absent when nothing matches. */
      count: string | null;
    }
  | { list: "admin"; organization: AdminSolutionList["organization"] };

/** The organizations holding a submitted solution whose name holds the text, the first page with none. */
async function findOrganizations(text: string | undefined) {
  const { data } = await listAdminSolutionOrganizationsWithSolutions({ query: { q: text } });
  return data.map(({ id, name }) => ({ value: id, label: name }));
}

/**
 * Search and filters of a list of solutions: the public directory's facets, or the operators' status,
 * industry and featured.
 */
function SolutionsToolbar(props: SolutionsToolbarProps) {
  const t = useTranslations("Solution.filters");
  const status = useVocabulary("reviewStatus");
  const industry = useVocabulary("industry");

  if (props.list === "directory") {
    return <SolutionsFilters count={props.count} />;
  }

  return (
    <FilterToolbar
      parsers={adminSolutionsSearch}
      searchLabel={t("adminSearch")}
      clearLabel={t("clear")}
      searchBehavior="submit"
      filters={[
        {
          key: "organizationId",
          label: t("organization.label"),
          all: t("organization.all"),
          // Asked of the server as one types: thousands of organizations hold a solution.
          options: props.organization
            ? [{ value: props.organization.id, label: props.organization.name }]
            : [],
          find: findOrganizations,
          searchable: {
            placeholder: t("organization.search"),
            empty: t("organization.empty"),
          },
        },
        {
          key: "status",
          label: t("status.label"),
          all: t("status.all"),
          options: reviewedStatuses.map((value) => ({ value, label: status(value) })),
        },
        {
          key: "industry",
          label: t("industry.label"),
          all: t("industry.all"),
          options: industries.map((value) => ({ value, label: industry(value) })),
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
        {
          key: "deployments",
          label: t("deployments.label"),
          all: t("deployments.all"),
          options: deploymentChoices.map((value) => ({ value, label: t("deployments.toReview") })),
        },
      ]}
    />
  );
}

export { SolutionsToolbar };
