"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useQueryStates, type UseQueryStatesKeysMap } from "nuqs";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/actions/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

/** The value a select shows when its filter is off; the URL then has no such parameter. */
const ALL = "all";
/** How long typing rests before the list is asked for. */
const SEARCH_DELAY_MS = 300;

type Filter = {
  /** The parameter of the URL the select writes. */
  key: string;
  label: string;
  /** The words of the select when the filter is off: "All statuses". */
  all: string;
  options: { value: string; label: string }[];
};

type FilterToolbarProps = {
  /** The list's description of its URL. It holds `q` and `page` beside one parameter per filter. */
  parsers: UseQueryStatesKeysMap;
  searchLabel: string;
  /** The words of the button that takes the search and every filter off. */
  clearLabel: string;
  filters: Filter[];
};

/**
 * The search field and the filters above a list. They are the URL: a change writes it and the server
 * renders the list again. Typing waits 300 ms before it asks, and any change returns to page 1
 * (docs/conventions.md › Lists). The "/" key moves to the search from anywhere outside a field.
 */
function FilterToolbar({ parsers, searchLabel, clearLabel, filters }: FilterToolbarProps) {
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(parsers, { shallow: false, startTransition });
  // The parameters are known by name only here; each list keeps their types in its own description.
  const values = search as Record<string, string | number | null>;
  const searchField = useRef<HTMLInputElement>(null);
  // What is typed and not yet in the address. The toolbar waits itself and then writes the search
  // and the return to page 1 as one change: nuqs debounces each parameter on its own timer, and the
  // second one's write could come after a link had already taken the search off.
  const [typed, setTyped] = useState<string | null>(null);
  const writing = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(writing.current), []);

  function type(text: string) {
    clearTimeout(writing.current);
    const write = () => {
      setTyped(null);
      setSearch({ q: text, page: null });
    };
    if (text) {
      setTyped(text);
      writing.current = setTimeout(write, SEARCH_DELAY_MS);
    } else {
      write();
    }
  }

  function clear() {
    clearTimeout(writing.current);
    setTyped(null);
    setSearch(null);
  }

  useEffect(() => {
    function toSearch(event: KeyboardEvent) {
      const typing = (event.target as HTMLElement).closest(
        "input, textarea, select, [contenteditable]",
      );
      if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        searchField.current?.focus();
      }
    }
    window.addEventListener("keydown", toSearch);
    return () => window.removeEventListener("keydown", toSearch);
  }, []);

  const narrowed = Boolean(values.q) || filters.some((filter) => values[filter.key] != null);

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <InputGroup className="md:flex-1">
        <InputGroupAddon>
          {loading ? <Spinner /> : <SearchIcon aria-hidden="true" />}
        </InputGroupAddon>
        <InputGroupInput
          ref={searchField}
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={typed ?? String(values.q ?? "")}
          maxLength={100}
          onChange={(event) => type(event.target.value)}
        />
        <InputGroupAddon align="inline-end" className="hidden md:flex">
          <Kbd aria-hidden="true">/</Kbd>
        </InputGroupAddon>
      </InputGroup>
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const items = [{ value: ALL, label: filter.all }, ...filter.options];
            return (
              <Select
                key={filter.key}
                items={items}
                value={String(values[filter.key] ?? ALL)}
                onValueChange={(value) =>
                  setSearch({ [filter.key]: value === ALL ? null : value, page: null })
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label={filter.label}
                  className="flex-1 md:w-44 md:flex-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            );
          })}
        </div>
      )}
      {narrowed && (
        <Button prominence="tertiary" size="sm" className="self-start md:self-auto" onClick={clear}>
          <XIcon aria-hidden="true" />
          {clearLabel}
        </Button>
      )}
    </div>
  );
}

export { FilterToolbar };
