"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useQueryStates, type UseQueryStatesKeysMap } from "nuqs";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/actions/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
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

type TextFilter = {
  /** The parameter of the URL the field writes. */
  key: string;
  label: string;
};

type FilterToolbarProps = {
  /** The list's description of its URL. It holds `q` and `page` beside one parameter per filter. */
  parsers: UseQueryStatesKeysMap;
  searchLabel: string;
  /** The words of the button that takes the search and every filter off. */
  clearLabel: string;
  /** Whether the search writes to the URL as it is typed, or only when submitted. */
  searchBehavior?: "live" | "submit";
  filters: Filter[];
  textFilters?: TextFilter[];
};

/**
 * The search field and filters above a list are the URL: live search waits 300 ms, submitted search
 * waits for Enter or its button, and any change returns to page 1 (docs/conventions.md › Lists).
 * The "/" key moves to the search from anywhere outside a field.
 */
function FilterToolbar({
  parsers,
  searchLabel,
  clearLabel,
  searchBehavior = "live",
  filters,
  textFilters = [],
}: FilterToolbarProps) {
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
  const [typedFilters, setTypedFilters] = useState<Record<string, string | null>>({});
  const filterWriting = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(
    () => () => {
      clearTimeout(writing.current);
      for (const timer of filterWriting.current.values()) {
        clearTimeout(timer);
      }
    },
    [],
  );

  function type(text: string) {
    if (searchBehavior === "submit") {
      setTyped(text);
      return;
    }

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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTimeout(writing.current);
    const query = typed ?? String(values.q ?? "");
    setTyped(null);
    setSearch({ q: query, page: null });
  }

  function clear() {
    clearTimeout(writing.current);
    for (const timer of filterWriting.current.values()) {
      clearTimeout(timer);
    }
    filterWriting.current.clear();
    setTyped(null);
    setTypedFilters({});
    setSearch(null);
  }

  function typeFilter(key: string, text: string) {
    clearTimeout(filterWriting.current.get(key));
    if (!text) {
      filterWriting.current.delete(key);
      setTypedFilters((current) => ({ ...current, [key]: null }));
      setSearch({ [key]: null, page: null });
      return;
    }

    setTypedFilters((current) => ({ ...current, [key]: text }));
    filterWriting.current.set(
      key,
      setTimeout(() => {
        setTypedFilters((current) => ({ ...current, [key]: null }));
        filterWriting.current.delete(key);
        setSearch({ [key]: text, page: null });
      }, SEARCH_DELAY_MS),
    );
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

  const narrowed =
    Boolean(values.q) ||
    filters.some((filter) => values[filter.key] != null) ||
    textFilters.some((filter) => String(values[filter.key] ?? "").trim() !== "");

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      {searchBehavior === "submit" ? (
        <form className="w-full md:flex-1" onSubmit={submitSearch}>
          <InputGroup className="h-11 md:h-8">
            {loading && (
              <InputGroupAddon>
                <Spinner />
              </InputGroupAddon>
            )}
            <InputGroupInput
              ref={searchField}
              type="search"
              aria-label={searchLabel}
              placeholder={searchLabel}
              value={typed ?? String(values.q ?? "")}
              maxLength={100}
              onChange={(event) => type(event.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="submit"
                size="icon-sm"
                aria-label={searchLabel}
                className="size-11 md:size-8"
              >
                <SearchIcon aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      ) : (
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
      )}
      {(filters.length > 0 || textFilters.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {textFilters.map((filter) => (
            <InputGroup key={filter.key} className="w-full md:w-44">
              <InputGroupAddon>
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label={filter.label}
                placeholder={filter.label}
                maxLength={100}
                value={typedFilters[filter.key] ?? String(values[filter.key] ?? "")}
                onChange={(event) => typeFilter(filter.key, event.target.value)}
              />
            </InputGroup>
          ))}
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
