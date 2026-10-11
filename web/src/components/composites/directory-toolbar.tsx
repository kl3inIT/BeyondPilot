import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/actions/button";
import { DirectorySearch } from "@/components/composites/directory-search";

type DirectoryToolbarProps = {
  search: {
    /** What the field searches, as its accessible name and its placeholder. */
    label: string;
    value: string;
    /** The list is being read again for the search just typed. */
    loading: boolean;
    onChange: (value: string) => void;
  };
  /** The filters and the order, each of a fixed width, so no choice moves its neighbours. */
  children: ReactNode;
  /**
   * How much of the list shows, already worded: "Showing 12 of 21". Null when nothing matches; the
   * line keeps its place. A directory that counts elsewhere leaves it out, and has no such line.
   */
  count?: string | null;
  /** The way back from the filters in use; absent while none narrows the list. */
  clear?: { label: string; onClick: () => void };
};

/**
 * The controls above a public directory, the same on each: the search takes the room left, the
 * filters and the order keep their widths, and the count and the way back from the filters have a
 * line of their own. Nothing in the row appears, leaves or changes width with the results, so the
 * controls stay where they are while a person searches.
 */
function DirectoryToolbar({ search, children, count, clear }: DirectoryToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <DirectorySearch className="max-w-none xl:min-w-56 xl:flex-1" {...search} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center xl:shrink-0">
          {children}
        </div>
      </div>
      {count !== undefined && (
        <div className="flex min-h-8 items-center gap-3">
          {count && <p className="text-sm text-muted-foreground">{count}</p>}
          {clear && (
            <Button prominence="tertiary" size="sm" onClick={clear.onClick}>
              <XIcon aria-hidden="true" />
              {clear.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export { DirectoryToolbar };
