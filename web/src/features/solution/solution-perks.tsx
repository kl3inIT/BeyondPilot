import { BadgeCheckIcon, ChevronRightIcon, GiftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import type { SolutionPerkLine } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { PerkFold } from "./perk-fold";

/** A perk's page, where who may get it and how are read. */
const pageOf = (perk: Pick<SolutionPerkLine, "slug">) => `${siteRoutes.perks}/${perk.slug}`;

/** What a perk is called on a card: its figure first, when it has one. */
function named(perk: Pick<SolutionPerkLine, "title" | "value">) {
  return perk.value ? `${perk.value} · ${perk.title}` : perk.title;
}

type PerkCornerProps = {
  perks: SolutionPerkLine[];
  /** Where the control sits on the card. */
  className?: string;
};

/**
 * The gift in the corner of a solution's card. With one perk it opens that perk's page; with several
 * it opens their list, each a link, since one press cannot lead to all of them.
 */
function PerkCorner({ perks, className }: PerkCornerProps) {
  const t = useTranslations("Solution.perks");

  if (perks.length === 0) {
    return null;
  }

  if (perks.length === 1) {
    const [perk] = perks;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              href={pageOf(perk)}
              prominence="secondary"
              size="sm"
              aria-label={t("openNamed", { perk: named(perk) })}
              className={className}
            >
              <GiftIcon aria-hidden="true" />
            </Button>
          }
        />
        <TooltipContent side="left">{named(perk)}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover>
      {/* The button holds its own content: it names its children itself, so those of the trigger would be lost. */}
      <PopoverTrigger
        render={
          <Button
            prominence="secondary"
            size="sm"
            aria-label={t("several", { count: perks.length })}
            className={className}
          >
            <GiftIcon aria-hidden="true" />
            {perks.length}
          </Button>
        }
      />
      <PopoverContent align="end">
        <PerkLinks perks={perks} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * What a perk is called. One GenAI Fund arranged carries the mark the card gives to what GenAI Fund
 * says of a solution, with the words for those who do not see it; one the organization wrote alone
 * has none.
 */
function PerkTitle({
  perk,
}: {
  perk: Pick<SolutionPerkLine, "title" | "value" | "fromGenAiFund">;
}) {
  const t = useTranslations("Solution.perks");

  return (
    <>
      {named(perk)}
      {perk.fromGenAiFund && (
        <>
          {" "}
          <BadgeCheckIcon
            className="inline size-4 shrink-0 align-text-bottom text-success"
            aria-hidden="true"
          />
          <span className="sr-only">{t("fromGenAiFund")}</span>
        </>
      )}
    </>
  );
}

/** The perks as a list of links, each to its page. */
function PerkLinks({ perks }: { perks: SolutionPerkLine[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {perks.map((perk) => (
        <li key={perk.slug}>
          <Link
            href={pageOf(perk)}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="min-w-0 wrap-break-word">
              <PerkTitle perk={perk} />
            </span>
            <ChevronRightIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * The line a card says its perks in: the first by name, and how many more there are. It stands on a
 * tint of its own, so a reader who scans the directory sees which solutions come with something. The
 * count opens the rest on hover, keyboard focus or a press, as the count of capabilities does.
 */
function PerkLine({ perks }: { perks: SolutionPerkLine[] }) {
  const t = useTranslations("Solution.perks");

  if (perks.length === 0) {
    return null;
  }

  return (
    <p className="flex min-w-0 items-center gap-2 rounded-lg bg-lemon px-3 py-2 text-sm font-semibold text-lemon-foreground">
      <GiftIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t("label")}</span>
      <span className="truncate">{named(perks[0])}</span>
      {perks.length > 1 && (
        <Popover>
          {/* Above the link that covers the card, so the pointer reaches it. */}
          <PopoverTrigger
            openOnHover
            delay={0}
            closeDelay={120}
            render={
              <button
                type="button"
                // The count of capabilities on the same card reads the same, so this one says what it counts.
                aria-label={t("morePerks", { count: perks.length - 1 })}
                className="relative z-10 shrink-0 rounded-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            }
          >
            {t("more", { count: perks.length - 1 })}
          </PopoverTrigger>
          <PopoverContent side="top" align="end" sideOffset={6}>
            <PerkLinks perks={perks.slice(1)} />
          </PopoverContent>
        </Popover>
      )}
    </p>
  );
}

/** One perk as a row of a group: its name, and the way to its page. */
function PerkRow({ perk }: { perk: SolutionPerkLine }) {
  const t = useTranslations("Solution.perks");

  return (
    <li className="flex items-center gap-3 border-t py-2">
      <span className="line-clamp-2 min-w-0 flex-1 text-sm wrap-anywhere">{named(perk)}</span>
      <Button
        prominence="secondary"
        size="sm"
        href={pageOf(perk)}
        aria-label={t("openNamed", { perk: named(perk) })}
      >
        {t("open")}
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </li>
  );
}

type PerkPanelProps = {
  perks: SolutionPerkLine[];
  /** The organization that gives the solution, which the perks it wrote alone come from. */
  organization: string;
};

/**
 * The perks on a solution's page, in two groups by where they come from: the ones GenAI Fund
 * arranged, which it stands behind, and the ones the organization wrote alone. Every perk is listed,
 * one row each, and the heading folds them all away.
 */
function PerkPanel({ perks, organization }: PerkPanelProps) {
  const t = useTranslations("Solution.perks");
  const groups = [
    {
      key: "fund",
      heading: (
        <>
          <BadgeCheckIcon className="size-3.5 shrink-0 text-success" aria-hidden="true" />
          {t("group.fund")}
        </>
      ),
      perks: perks.filter((perk) => perk.fromGenAiFund),
    },
    {
      key: "own",
      heading: t("group.own", { organization }),
      perks: perks.filter((perk) => !perk.fromGenAiFund),
    },
  ].filter((group) => group.perks.length > 0);

  if (groups.length === 0) {
    return null;
  }

  return (
    <PerkFold title={t("title")}>
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <span className="flex min-w-0 items-center gap-1.5">{group.heading}</span>
            <span className="ml-auto font-medium tracking-normal normal-case">
              {group.perks.length}
            </span>
          </h3>
          <ul className="flex flex-col [&>li:first-child]:border-t-0 [&>li:first-child]:pt-1">
            {group.perks.map((perk) => (
              <PerkRow key={perk.slug} perk={perk} />
            ))}
          </ul>
        </div>
      ))}
    </PerkFold>
  );
}

export { PerkCorner, PerkLine, PerkPanel, PerkTitle };
