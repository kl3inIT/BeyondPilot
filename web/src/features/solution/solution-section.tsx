"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useId } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "cn";

type SolutionSectionProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
  contentClassName?: string;
  tone?: "plain" | "proof";
};

/** A solution detail section that starts open and can be folded from its heading. */
function SolutionSection({
  title,
  icon,
  children,
  description,
  contentClassName,
  tone = "plain",
}: SolutionSectionProps) {
  const contentId = useId();

  return (
    <Collapsible defaultOpen render={<section className="flex flex-col" />}>
      <h2 className="w-full">
        <CollapsibleTrigger aria-controls={contentId} variant="section">
          <span
            className={cn(
              "flex min-w-0 items-center gap-2 text-xl font-semibold [&_svg]:size-5 [&_svg]:shrink-0",
              tone === "proof" ? "[&_svg]:text-success" : "[&_svg]:text-muted-foreground",
            )}
          >
            {icon}
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
      <CollapsibleContent id={contentId} className="overflow-hidden">
        <div className={cn("flex flex-col gap-3 pt-2", contentClassName)}>
          {description}
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { SolutionSection };
