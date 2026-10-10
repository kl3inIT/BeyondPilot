"use client";

import { CircleHelpIcon } from "lucide-react";

import { IconButton } from "@/components/actions/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type HelpPopoverProps = {
  /** What the button opens, for the people who do not see the icon: "What a verified domain is". */
  label: string;
  children: React.ReactNode;
};

/**
 * Help that only some people need, such as what a term means: a "?" beside the term that opens on a
 * click or a tap, never on hover, so it works on a phone and from the keyboard. What most people
 * need to act is shown on the screen instead (docs/conventions.md › Help text).
 */
function HelpPopover({ label, children }: HelpPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger render={<IconButton prominence="tertiary" size="sm" aria-label={label} />}>
        <CircleHelpIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start">{children}</PopoverContent>
    </Popover>
  );
}

export { HelpPopover };
