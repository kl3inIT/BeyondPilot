import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { useVocabulary } from "@/i18n/vocabulary";
import type { Solution } from "@/lib/api/generated";

/** What a review reads of a solution. */
type SolutionRecordProps = {
  solution: Pick<
    Solution,
    | "name"
    | "summary"
    | "problemsSolved"
    | "valueProposition"
    | "focusAreas"
    | "industries"
    | "maturity"
    | "deployment"
    | "website"
    | "demoUrl"
    | "deck"
    | "traction"
    | "builtWith"
    | "languages"
    | "bestCustomerProfile"
    | "customerDeployments"
  >;
};

/**
 * A solution as an operator reviews it: every field its owners can fill in, under its label and in
 * the groups of their editor. A field they left empty keeps its row and says so, because a review
 * decides on what is missing as much as on what is there.
 */
function SolutionRecord({ solution }: SolutionRecordProps) {
  const t = useTranslations("Admin.solutions.record");
  const focusArea = useVocabulary("focusArea");
  const industry = useVocabulary("industry");
  const maturity = useVocabulary("maturity");
  const deployment = useVocabulary("deployment");
  const language = useVocabulary("language");

  const words = (labels: string[]) => (labels.length > 0 ? labels.join(", ") : null);
  const link = (href: string | null | undefined) =>
    href ? (
      <TextButton href={href} target="_blank" rel="noreferrer" className="break-all">
        {href.replace(/^https?:\/\//, "")}
        <ExternalLinkIcon aria-hidden="true" />
      </TextButton>
    ) : null;
  const waiting = solution.customerDeployments.filter((item) => item.status === "submitted").length;

  const groups: { title: string; rows: { label: string; value: React.ReactNode }[] }[] = [
    {
      title: t("basics"),
      rows: [
        { label: t("name"), value: solution.name },
        { label: t("summary"), value: solution.summary },
        { label: t("problemsSolved"), value: solution.problemsSolved },
        { label: t("valueProposition"), value: solution.valueProposition },
        { label: t("maturity"), value: solution.maturity ? maturity(solution.maturity) : null },
        { label: t("traction"), value: solution.traction },
        { label: t("builtWith"), value: words(solution.builtWith) },
      ],
    },
    {
      title: t("audience"),
      rows: [
        { label: t("industries"), value: words(solution.industries.map(industry)) },
        { label: t("focusAreas"), value: words(solution.focusAreas.map(focusArea)) },
        { label: t("languages"), value: words(solution.languages.map(language)) },
        { label: t("deployment"), value: words(solution.deployment.map(deployment)) },
        { label: t("bestCustomerProfile"), value: solution.bestCustomerProfile },
      ],
    },
    {
      title: t("evidence"),
      rows: [
        { label: t("website"), value: link(solution.website) },
        { label: t("demo"), value: link(solution.demoUrl) },
        // The file is named, not linked: the address of a deck answers only once its solution is approved.
        { label: t("deck"), value: solution.deck?.fileName ?? null },
        {
          label: t("deployments"),
          value:
            solution.customerDeployments.length > 0
              ? t("deploymentsSummary", { total: solution.customerDeployments.length, waiting })
              : null,
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.title} className="rounded-lg border bg-card p-5">
          <h2 className="text-base font-semibold">{group.title}</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-4 sm:gap-y-3">
            {group.rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="pb-2 text-sm whitespace-pre-line sm:col-span-3 sm:pb-0">
                  {row.value ?? <span className="text-muted-foreground">{t("missing")}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export { SolutionRecord };
