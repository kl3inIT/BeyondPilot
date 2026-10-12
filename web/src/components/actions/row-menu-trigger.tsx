"use client";

import { EllipsisIcon } from "lucide-react";
import { cn } from "cn";

import { IconButton } from "@/components/actions/icon-button";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type RowMenuTriggerProps = {
  /** Names the menu and the record it acts on: "Actions for Plain Cover". */
  "aria-label": string;
  /** While the row's action is being sent. */
  disabled?: boolean;
  className?: string;
};

/**
 * The "⋯" control that opens the menu of a row's actions (docs/conventions.md › Lists): the
 * tertiary 32px `IconButton`, which stays tinted while its menu is open. It stands inside a
 * `DropdownMenu`, before the menu's content.
 */
function RowMenuTrigger({ className, disabled, ...props }: RowMenuTriggerProps) {
  return (
    <DropdownMenuTrigger
      disabled={disabled}
      render={
        <IconButton
          prominence="tertiary"
          size="sm"
          className={cn(
            "data-popup-open:bg-accent data-popup-open:text-accent-foreground",
            className,
          )}
          {...props}
        />
      }
    >
      <EllipsisIcon aria-hidden="true" />
    </DropdownMenuTrigger>
  );
}

export { RowMenuTrigger };
