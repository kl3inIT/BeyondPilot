import { cva, type VariantProps } from "class-variance-authority";
import { ExternalLinkIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { useVocabulary } from "@/i18n/vocabulary";
import type { Solution, SolutionImage } from "@/lib/api/generated";
import { publicFileUrl } from "@/lib/storage/upload";

const pictureVariants = cva(
  "relative block h-14 overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: {
      shape: {
        square: "w-14",
        wide: "w-25",
      },
    },
  },
);

type PictureProps = Required<VariantProps<typeof pictureVariants>> & {
  image: SolutionImage;
  /** What the image is to the solution: its logo, its cover, or its place under the cover. */
  caption: string;
  /** The words for opening it, which name the file. */
  label: string;
};

/** One image of a solution in a review, small, opening the file itself in a new tab. */
function Picture({ image, caption, label, shape }: PictureProps) {
  return (
    <li className="flex flex-col items-center gap-1">
      <a
        href={publicFileUrl(image.fileId)}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        className={pictureVariants({ shape })}
      >
        <Image
          src={publicFileUrl(image.fileId)}
          alt=""
          fill
          sizes="100px"
          unoptimized
          className={shape === "wide" ? "object-cover" : "object-contain"}
        />
      </a>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </li>
  );
}

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
      <TextButton href={href} target="_blank" rel="noreferrer" className="break-all">
        {href.replace(/^https?:\/\//, "")}
        <ExternalLinkIcon aria-hidden="true" />
      </TextButton>
    ) : null;
  const waiting = solution.customerDeployments.filter((item) => item.status === "submitted").length;
  const pictured = solution.logo || solution.cover || solution.images.length > 0;
  const open = (image: SolutionImage) => t("openImage", { name: image.fileName });

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
      lead: pictured && (
        <div className="mt-3 flex flex-col gap-2">
          <h3 className="text-sm text-muted-foreground">{t("images")}</h3>
          <ul className="flex flex-wrap gap-2">
            {solution.logo && (
              <Picture
                image={solution.logo}
                caption={t("logo")}
                label={open(solution.logo)}
                shape="square"
              />
            )}
            {solution.cover && (
              <Picture
                image={solution.cover}
                caption={t("cover")}
                label={open(solution.cover)}
                shape="wide"
              />
            )}
            {solution.images.map((image, index) => (
              <Picture
                key={image.fileId}
                image={image}
                caption={String(index + 1)}
                label={open(image)}
                shape="square"
              />
            ))}
          </ul>
        </div>
      ),
      rows: [
        // An image that is there shows above; one that is not keeps its row, as every empty field does.
        ...(solution.logo ? [] : [{ label: t("logo"), value: null }]),
        ...(solution.cover ? [] : [{ label: t("coverImage"), value: null }]),
        ...(solution.images.length > 0 ? [] : [{ label: t("moreImages"), value: null }]),
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
          {group.lead}
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
