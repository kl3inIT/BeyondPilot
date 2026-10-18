import { ArrowUpRightIcon, BadgeCheckIcon, GiftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PublicOffer } from "@/lib/api/generated";

/** An offer is claimed on another site: it opens beside this one and is told nothing of where it came from. */
const outside = { target: "_blank", rel: "noopener noreferrer nofollow" } as const;

type OfferCornerProps = {
  offers: PublicOffer[];
  /** Where the control sits on the card. */
  className?: string;
};

/**
 * The gift in the corner of a solution's card. With one offer it is the link to where that offer is
 * claimed; with several it opens their list, each a link, since one press cannot lead to all of them.
 */
function OfferCorner({ offers, className }: OfferCornerProps) {
  const t = useTranslations("Solution.offers");

  if (offers.length === 0) {
    return null;
  }

  if (offers.length === 1) {
    const [offer] = offers;
    return (
      <Tooltip>
        {/* A link, not a button: it leaves for another site, and is announced as what it is. */}
        <TooltipTrigger
          render={
            <Button
              href={offer.url}
              {...outside}
              prominence="secondary"
              size="sm"
              aria-label={t("claimNamed", { offer: offer.title })}
              className={className}
            >
              <GiftIcon aria-hidden="true" />
            </Button>
          }
        />
        <TooltipContent side="left">{offer.title}</TooltipContent>
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
            aria-label={t("several", { count: offers.length })}
            className={className}
          >
            <GiftIcon aria-hidden="true" />
            {offers.length}
          </Button>
        }
      />
      <PopoverContent align="end">
        <OfferLinks offers={offers} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * What an offer is called. One GenAI Fund arranged carries the mark the card gives to what GenAI
 * Fund says of a solution, with the words for those who do not see it; one the organization wrote
 * alone has none.
 */
function OfferTitle({ offer }: { offer: Pick<PublicOffer, "title" | "fromGenAiFund"> }) {
  const t = useTranslations("Solution.offers");

  return (
    <>
      {offer.title}
      {offer.fromGenAiFund && (
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

/** The offers as a list of links, each to where it is claimed. */
function OfferLinks({ offers }: { offers: PublicOffer[] }) {
  const t = useTranslations("Solution.offers");

  return (
    <ul className="flex flex-col gap-0.5">
      {offers.map((offer) => (
        <li key={offer.title}>
          <a
            href={offer.url}
            {...outside}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="min-w-0 wrap-break-word">
              <OfferTitle offer={offer} />
            </span>
            <ArrowUpRightIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="sr-only">{t("newTab")}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The line a card says its offers in: the first by name, and how many more there are. It stands on a
 * tint of its own, so a reader who scans the directory sees which solutions come with something. The
 * count opens the rest on hover, keyboard focus or a press, as the count of capabilities does.
 */
function OfferLine({ offers }: { offers: PublicOffer[] }) {
  const t = useTranslations("Solution.offers");

  if (offers.length === 0) {
    return null;
  }

  return (
    <p className="flex min-w-0 items-center gap-2 rounded-lg bg-lemon px-3 py-2 text-sm font-semibold text-lemon-foreground">
      <GiftIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t("label")}</span>
      <span className="truncate">{offers[0].title}</span>
      {offers.length > 1 && (
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
                aria-label={t("moreOffers", { count: offers.length - 1 })}
                className="relative z-10 shrink-0 rounded-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            }
          >
            {t("more", { count: offers.length - 1 })}
          </PopoverTrigger>
          <PopoverContent side="top" align="end" sideOffset={6}>
            <OfferLinks offers={offers.slice(1)} />
          </PopoverContent>
        </Popover>
      )}
    </p>
  );
}

/** The offers on a solution's page: each by name, with the action that claims it. */
function OfferPanel({ offers }: { offers: PublicOffer[] }) {
  const t = useTranslations("Solution.offers");

  if (offers.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="solution-offers" className="flex flex-col gap-3">
      <h2 id="solution-offers" className="flex items-center gap-2 text-base font-medium">
        <GiftIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-3">
        {offers.map((offer) => (
          <li key={offer.title} className="flex flex-col gap-2">
            <p className="text-sm wrap-break-word">
              <OfferTitle offer={offer} />
            </p>
            <Button
              prominence="secondary"
              size="lg"
              className="w-full"
              href={offer.url}
              {...outside}
              aria-label={t("claimNamed", { offer: offer.title })}
            >
              {t("claim")}
              <ArrowUpRightIcon aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { OfferCorner, OfferLine, OfferPanel, OfferTitle };
