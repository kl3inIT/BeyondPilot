"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { TextButton } from "@/components/actions/text-button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type OfferFoldProps = {
  /** How many offers the fold keeps out of sight. */
  hidden: number;
  /** The offers it keeps, drawn by the page. */
  children: React.ReactNode;
};

/** The offers of a group past the first few: folded away, and opened by the line under them. */
function OfferFold({ hidden, children }: OfferFoldProps) {
  const t = useTranslations("Solution.offers");
  const contentId = useId();

  return (
    <Collapsible render={<div className="flex flex-col" />}>
      <CollapsibleContent id={contentId}>{children}</CollapsibleContent>
      <CollapsibleTrigger
        aria-controls={contentId}
        render={<TextButton className="group/offer-fold mt-1 w-fit cursor-pointer" />}
      >
        <span className="group-aria-expanded/offer-fold:hidden">
          {t("showMore", { count: hidden })}
        </span>
        <span className="hidden group-aria-expanded/offer-fold:inline">{t("showFewer")}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className="transition-transform group-aria-expanded/offer-fold:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
    </Collapsible>
  );
}

export { OfferFold };
