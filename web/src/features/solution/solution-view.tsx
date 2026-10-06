import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { CodeList } from "@/components/composites/code-list";
import { useVocabulary } from "@/i18n/vocabulary";
import type { Solution } from "@/lib/api/generated";

import { deckAddress, useFileSize } from "./solution-deck";

/** What a solution says about itself, as its organization and the operators read it. */
type SolutionContent = Pick<
  Solution,
  | "slug"
  | "summary"
  | "problemsSolved"
  | "valueProposition"
  | "traction"
  | "bestCustomerProfile"
  | "focusAreas"
  | "industries"
  | "languages"
  | "maturity"
  | "deployment"
  | "builtWith"
  | "website"
  | "demoUrl"
  | "deck"
>;

/**
 * A solution as its organization wrote it: its long answers on the left, its facts and its links on
 * the right. It serves the operators' review and a member who may not edit; the public page has its
 * own layout.
 */
function SolutionView({ solution }: { solution: SolutionContent }) {
  const t = useTranslations("Solution.view");
  const focusArea = useVocabulary("focusArea");
  const industry = useVocabulary("industry");
  const language = useVocabulary("language");
  const maturity = useVocabulary("maturity");
  const deployment = useVocabulary("deployment");
  const size = useFileSize();

  const answers = [
    { title: t("problemsSolved"), body: solution.problemsSolved },
    { title: t("valueProposition"), body: solution.valueProposition },
    { title: t("traction"), body: solution.traction },
    { title: t("bestCustomerProfile"), body: solution.bestCustomerProfile },
  ].filter((answer) => answer.body);
  const facts = [
    { title: t("maturity"), labels: solution.maturity ? [maturity(solution.maturity)] : [] },
    { title: t("industries"), labels: solution.industries.map(industry) },
    { title: t("focusAreas"), labels: solution.focusAreas.map(focusArea) },
    { title: t("languages"), labels: solution.languages.map(language) },
    { title: t("deployment"), labels: solution.deployment.map(deployment) },
    { title: t("builtWith"), labels: solution.builtWith },
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
        {(
          [
            ["website", solution.website],
            ["demo", solution.demoUrl],
          ] as const
        ).map(
          ([key, href]) =>
            href && (
              <TextButton
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="self-start"
              >
                {t(key)}
                <ExternalLinkIcon aria-hidden="true" />
              </TextButton>
            ),
        )}
        {solution.deck && (
          <div className="flex flex-col gap-0.5">
            <TextButton href={deckAddress(solution.slug)} className="self-start">
              {t("deck")}
              <DownloadIcon aria-hidden="true" />
            </TextButton>
            <span className="text-xs text-muted-foreground">
              {solution.deck.fileName} · {size(solution.deck.sizeBytes)}
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}

export { SolutionView };
