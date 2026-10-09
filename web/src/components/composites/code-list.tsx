import { cn } from "cn";

import { Badge } from "@/components/ui/badge";

type CodeListProps = {
  /** The words for each code, already translated, in the order to show them. */
  labels: string[];
  /** How many to show before the rest is counted, for a card with little room. */
  limit?: number;
  /** The words on the action that reveals what was left out: "+3 more". */
  more?: string;
};

/**
 * A few values of a vocabulary as outline chips, such as the industries of a solution. A limit
 * holds them to one line: what fits is shown and the rest waits under the "+N more" chip, which
 * reveals a dropdown on hover or keyboard focus. Without a limit every chip shows and the line
 * wraps.
 */
function CodeList({ labels, limit, more }: CodeListProps) {
  const shown = limit === undefined ? labels : labels.slice(0, limit);
  const hidden = labels.slice(shown.length);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <ul
        data-slot="code-list"
        className={cn(
          "flex min-w-0 gap-1.5",
          limit === undefined ? "flex-wrap" : "flex-nowrap overflow-hidden",
        )}
      >
        {shown.map((label) => (
          <li key={label} className="min-w-0 shrink">
            <Badge variant="outline" className="max-w-full shrink">
              <span className="truncate">{label}</span>
            </Badge>
          </li>
        ))}
      </ul>
      {hidden.length > 0 && more && (
        <div className="group relative">
          <button
            type="button"
            className="peer group/badge inline-flex h-6 w-fit shrink-0 cursor-pointer items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent bg-secondary px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-secondary-foreground transition-all hover:bg-secondary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {more}
          </button>
          <div className="invisible absolute top-full right-0 z-50 mt-1.5 rounded-lg bg-popover p-2 text-sm text-popover-foreground opacity-0 shadow-md ring-1 ring-foreground/10 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
            <ul className="flex w-max max-w-72 flex-wrap gap-1.5">
              {hidden.map((label) => (
                <li key={label}>
                  <Badge variant="outline">{label}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export { CodeList };
