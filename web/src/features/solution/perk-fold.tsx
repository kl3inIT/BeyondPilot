"use client";

import { GiftIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useId } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type PerkFoldProps = {
  title: string;
  /** The perks, drawn by the page. */
  children: React.ReactNode;
};

/**
 * The perks of a solution's page under their heading: open at first, and folded from the heading,
 * as the parts of the page beside it are.
 */
function PerkFold({ title, children }: PerkFoldProps) {
  const contentId = useId();

  return (
    <Collapsible
      defaultOpen
      render={<section aria-labelledby="solution-perks" className="flex flex-col" />}
    >
      <h2 id="solution-perks" className="w-full">
        <CollapsibleTrigger aria-controls={contentId} variant="section">
          <span className="flex min-w-0 items-center gap-2 text-base font-medium">
            <GiftIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {title}
          </span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground group-focus-visible/collapsible-section-trigger:ring-2 group-focus-visible/collapsible-section-trigger:ring-ring group-focus-visible/collapsible-section-trigger:ring-offset-2">
            <PlusIcon
              aria-hidden="true"
              className="size-4 group-aria-expanded/collapsible-section-trigger:hidden"
            />
            <MinusIcon
              aria-hidden="true"
              className="hidden size-4 group-aria-expanded/collapsible-section-trigger:inline"
            />
          </span>
        </CollapsibleTrigger>
      </h2>
      {/* Wider than its rows by the ring of a focused button, which the fold would otherwise cut. */}
      <CollapsibleContent id={contentId} className="-mx-1">
        <div className="flex flex-col gap-3 p-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { PerkFold };
