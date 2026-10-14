import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { useVocabulary } from "@/i18n/vocabulary";
import type { Solution, SolutionImage } from "@/lib/api/generated";

import { deckAddress } from "./solution-deck";
import { SolutionDeckPreview } from "./solution-deck-preview";
import { SolutionRecordImages } from "./solution-record-images";

/** What a review reads of a solution. */
type SolutionRecordProps = {
  solution: Pick<
    Solution,
    | "slug"
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
    | "logo"
    | "cover"
    | "images"
    | "traction"
    | "builtWith"
    | "languages"
    | "bestCustomerProfile"
    | "channels"
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
      <TextButton
        href={href}
        target="_blank"
        rel="noreferrer"
        className="max-w-full break-all whitespace-normal"
      >
        {href.replace(/^https?:\/\//, "")}
        <ExternalLinkIcon aria-hidden="true" />
      </TextButton>
    ) : null;
  const waiting = solution.customerDeployments.filter((item) => item.status === "in_review").length;
  const open = (image: SolutionImage) => t("openImage", { name: image.fileName });
  const picture = (image: SolutionImage, caption: string, shape: "square" | "wide") => ({
    fileId: image.fileId,
    caption,
    label: open(image),
    shape,
  });
  const pictures = [
    ...(solution.logo ? [picture(solution.logo, t("logo"), "square")] : []),
    ...(solution.cover ? [picture(solution.cover, t("cover"), "wide")] : []),
    ...solution.images.map((image, index) => picture(image, String(index + 1), "square")),
  ];
  const deck = solution.deck && (
    <div className="flex flex-wrap items-center gap-2">
      <span className="break-all">{solution.deck.fileName}</span>
      <SolutionDeckPreview fileName={solution.deck.fileName} fileUrl={deckAddress(solution.slug)} />
    </div>
  );

  const groups: {
    title: string;
    /** What the group shows before its rows. */
    lead?: React.ReactNode;
    rows: { label: string; value: React.ReactNode }[];
  }[] = [
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
        { label: t("channels"), value: solution.channels },
        { label: t("bestCustomerProfile"), value: solution.bestCustomerProfile },
      ],
    },
    {
      title: t("evidence"),
      lead: pictures.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <h3 className="text-sm text-muted-foreground">{t("images")}</h3>
          <SolutionRecordImages name={solution.name} images={pictures} />
        </div>
      ),
      rows: [
        // An image that is there shows above; one that is not keeps its row, as every empty field does.
        ...(solution.logo ? [] : [{ label: t("logo"), value: null }]),
        ...(solution.cover ? [] : [{ label: t("coverImage"), value: null }]),
        ...(solution.images.length > 0 ? [] : [{ label: t("moreImages"), value: null }]),
        { label: t("website"), value: link(solution.website) },
        { label: t("demo"), value: link(solution.demoUrl) },
        // The preview uses the permission-checked deck route; the direct file address is private.
        { label: t("deck"), value: deck },
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
          {group.lead}
          <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-4 sm:gap-y-3">
            {group.rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 pb-2 text-sm break-words whitespace-pre-line sm:col-span-3 sm:pb-0">
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
