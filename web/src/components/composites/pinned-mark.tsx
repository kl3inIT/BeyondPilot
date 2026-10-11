import { cn } from "cn";
import { PinIcon } from "lucide-react";

/**
 * Says that an operator pinned a record to the top of its public directory: a pin and the word,
 * given already translated, never the colour alone.
 */
function PinnedMark({ className, children, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="pinned-mark"
      className={cn("inline-flex items-center gap-1 text-xs font-medium", className)}
      {...props}
    >
      <PinIcon className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

export { PinnedMark };
