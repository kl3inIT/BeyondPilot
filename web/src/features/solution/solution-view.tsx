import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { CodeList } from "@/components/composites/code-list";
import { useVocabulary } from "@/i18n/vocabulary";
import type { PublicSolution } from "@/lib/api/generated";

/** What a solution says about itself, in every place it is read. */
type SolutionContent = Pick<
  PublicSolution,
  | "summary"
  | "problemsSolved"
  | "valueProposition"
  | "focusAreas"
  | "industries"
  | "maturity"
  | "deployment"
  | "website"
>;

/**
 * A solution as its organization wrote it: its long answers on the left, its facts on the right.
 * It serves the operators' review and a member who may not edit; the public page has its own layout.
 */
function SolutionView({ solution }: { solution: SolutionContent }) {
  const t = useTranslations("Solution.view");
  const focusArea = useVocabulary("focusArea");
  const industry = useVocabulary("industry");
  const maturity = useVocabulary("maturity");
  const deployment = useVocabulary("deployment");

  const answers = [
    { title: t("problemsSolved"), body: solution.problemsSolved },
    { title: t("valueProposition"), body: solution.valueProposition },
  ].filter((answer) => answer.body);
  const facts = [
    { title: t("maturity"), labels: solution.maturity ? [maturity(solution.maturity)] : [] },
    { title: t("focusAreas"), labels: solution.focusAreas.map(focusArea) },
    { title: t("industries"), labels: solution.industries.map(industry) },
    { title: t("deployment"), labels: solution.deployment.map(deployment) },
  ].filter((fact) => fact.labels.length > 0);

  return (
    <div className="grid gap-10 lg:grid-cols-3">
      <div className="flex flex-col gap-8 lg:col-span-2">
        {solution.summary && <p className="text-lg text-pretty">{solution.summary}</p>}
        {answers.map((answer) => (
          <section key={answer.title} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{answer.title}</h2>
            <p className="max-w-prose whitespace-pre-line text-muted-foreground">{answer.body}</p>
          </section>
        ))}
        {!solution.summary && answers.length === 0 && (
          <p className="text-muted-foreground">{t("nothingYet")}</p>
        )}
      </div>
      <aside className="flex flex-col gap-6">
        {facts.map((fact) => (
          <div key={fact.title} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{fact.title}</h2>
            <CodeList labels={fact.labels} />
          </div>
        ))}
        {solution.website && (
          <TextButton
            href={solution.website}
            target="_blank"
            rel="noreferrer"
            className="self-start"
          >
            {t("website")}
            <ExternalLinkIcon aria-hidden="true" />
          </TextButton>
        )}
      </aside>
    </div>
  );
}

export { SolutionView };
