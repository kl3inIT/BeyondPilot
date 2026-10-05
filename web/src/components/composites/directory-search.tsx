import { SearchIcon } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";

/** The longest search the field takes. */
const SEARCH_MAX_LENGTH = 100;

type DirectorySearchProps = {
  /** What the field searches, as its accessible name and its placeholder. */
  label: string;
  value: string;
  /** The list is being read again for the search just typed. */
  loading: boolean;
  onChange: (value: string) => void;
};

/**
 * The search of a public directory, 48px tall as the Figma frames draw it, which no size of the
 * registry `input-group` is. The directory owns the value, which is its URL.
 */
function DirectorySearch({ label, value, loading, onChange }: DirectorySearchProps) {
  return (
    <label className="flex h-12 w-full max-w-180 items-center gap-2.5 rounded-xl border border-input bg-background px-3.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {loading ? (
        <Spinner className="size-4.5" />
      ) : (
        <SearchIcon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        maxLength={SEARCH_MAX_LENGTH}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export { DirectorySearch };
