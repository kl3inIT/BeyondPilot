import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
 * reveals a positioned popover on hover, keyboard focus, or press. Long labels there stay on one
 * line and truncate. Without a limit every chip shows and the line wraps.
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
        <Popover>
          <PopoverTrigger
            openOnHover
            delay={0}
            closeDelay={120}
            render={<Badge variant="secondary" render={<button type="button" />} />}
          >
            {more}
          </PopoverTrigger>
          <PopoverContent side="top" align="end" sideOffset={6}>
            <ul className="flex w-full min-w-0 flex-wrap gap-1.5">
              {hidden.map((label) => (
                <li key={label} className="max-w-full min-w-0">
                  <Badge
                    variant="outline"
                    className="max-w-full min-w-0 shrink overflow-hidden whitespace-nowrap"
                  >
                    <span className="block min-w-0 truncate" title={label}>
                      {label}
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export { CodeList };
