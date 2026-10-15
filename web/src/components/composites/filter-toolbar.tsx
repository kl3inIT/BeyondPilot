"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useQueryStates, type UseQueryStatesKeysMap } from "nuqs";
import { Fragment, useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/actions/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
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
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

/** The value a select shows when its filter is off; the URL then has no such parameter. */
const ALL = "all";
/** How long typing rests before the list is asked for. */
const SEARCH_DELAY_MS = 300;

type Option = { value: string; label: string };

/** Options that belong together, under the name of what they share. */
type OptionGroup = { label: string; options: Option[] };

type Filter = {
  /** The parameter of the URL the select writes. */
  key: string;
  label: string;
  /**
   * The words of the select when the filter is off: "All statuses". A filter without them is never off: it
   * always holds one of its options, and its parser's default is the one the URL leaves out (a period).
   */
  all?: string;
  /**
   * What the select offers. A long list is given in groups, each under its name, so a reader finds
   * the part it is in before the option; options given outside a group come first.
   */
  options: (Option | OptionGroup)[];
  /**
   * A list too long to read through, such as a hundred actions: the select opens with a field that
   * narrows the options as one types, with the words it shows empty and when nothing matches.
   */
  searchable?: { placeholder: string; empty: string };
};

function isGroup(entry: Option | OptionGroup): entry is OptionGroup {
  return "options" in entry;
}

type TextFilter = {
  /** The parameter of the URL the field writes. */
  key: string;
  label: string;
};

type FilterToolbarProps = {
  /** The list's description of its URL. It holds `q` beside one parameter per filter and those of `resets`. */
  parsers: UseQueryStatesKeysMap;
  /**
   * The parameters that say where in the list the reader is, which any change of the search or a filter takes
   * off: `page` for a list paged by number, `before` and `after` for one paged by cursor.
   */
  resets?: string[];
  searchLabel: string;
  /** The words of the button that takes the search and every filter off. */
  clearLabel: string;
  /** Whether the search writes to the URL as it is typed, or only when submitted. */
  searchBehavior?: "live" | "submit";
  filters: Filter[];
  textFilters?: TextFilter[];
};

/** The value a parser falls back to when the URL leaves its parameter out. */
function defaultOf(parsers: UseQueryStatesKeysMap, key: string) {
  return (parsers[key] as { defaultValue?: unknown } | undefined)?.defaultValue ?? null;
}

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
  resets = ["page"],
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
  // Back to the start of the list.
  const start = Object.fromEntries(resets.map((key) => [key, null]));

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
      setSearch({ q: text, ...start });
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
    setSearch({ q: query, ...start });
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
      setSearch({ [key]: null, ...start });
      return;
    }

    setTypedFilters((current) => ({ ...current, [key]: text }));
    filterWriting.current.set(
      key,
      setTimeout(() => {
        setTypedFilters((current) => ({ ...current, [key]: null }));
        filterWriting.current.delete(key);
        setSearch({ [key]: text, ...start });
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
    filters.some((filter) =>
      filter.all === undefined
        ? values[filter.key] !== defaultOf(parsers, filter.key)
        : values[filter.key] != null,
    ) ||
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
            const groups = filter.options.filter(isGroup);
            // What stands outside a group: the words for "off", then the options given alone.
            const loose = [
              ...(filter.all === undefined ? [] : [{ value: ALL, label: filter.all }]),
              ...filter.options.filter((entry): entry is Option => !isGroup(entry)),
            ];
            const chosen = String(values[filter.key] ?? ALL);
            if (filter.searchable) {
              const all = [...loose, ...groups.flatMap((group) => group.options)];
              // The options outside a group come first, in a group without a name.
              const listed = [
                ...(loose.length > 0 ? [{ label: "", options: loose }] : []),
                ...groups,
              ].map((group) => ({ value: group.label, items: group.options }));
              return (
                <Combobox
                  key={filter.key}
                  items={listed}
                  autoHighlight
                  value={all.find((item) => item.value === chosen) ?? null}
                  isItemEqualToValue={(item: Option, other: Option) => item.value === other.value}
                  itemToStringLabel={(item: Option) => item.label}
                  onValueChange={(item: Option | null) => {
                    if (!item) {
                      return;
                    }
                    setSearch({
                      [filter.key]:
                        item.value === ALL && filter.all !== undefined ? null : item.value,
                      ...start,
                    });
                  }}
                >
                  <ComboboxTrigger
                    size="sm"
                    aria-label={filter.label}
                    className="flex-1 md:max-w-72 md:min-w-36 md:flex-none"
                  >
                    <span className="min-w-0 flex-1 truncate text-left">
                      <ComboboxValue />
                    </span>
                  </ComboboxTrigger>
                  <ComboboxContent className="md:w-80">
                    <ComboboxInput
                      showTrigger={false}
                      placeholder={filter.searchable.placeholder}
                      aria-label={filter.searchable.placeholder}
                    />
                    <ComboboxEmpty>{filter.searchable.empty}</ComboboxEmpty>
                    <ComboboxList aria-label={filter.label}>
                      {(group: { value: string; items: Option[] }, index: number) => (
                        <Fragment key={group.value}>
                          {index > 0 && <ComboboxSeparator />}
                          <ComboboxGroup items={group.items}>
                            {group.value && <ComboboxLabel>{group.value}</ComboboxLabel>}
                            <ComboboxCollection>
                              {(item: Option) => (
                                <ComboboxItem key={item.value} value={item}>
                                  {item.label}
                                </ComboboxItem>
                              )}
                            </ComboboxCollection>
                          </ComboboxGroup>
                        </Fragment>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              );
            }
            return (
              <Select
                key={filter.key}
                // Every option by its value: the trigger finds the words of the chosen one there.
                items={[...loose, ...groups.flatMap((group) => group.options)]}
                value={chosen}
                onValueChange={(value) =>
                  setSearch({
                    [filter.key]: value === ALL && filter.all !== undefined ? null : value,
                    ...start,
                  })
                }
              >
                {/*
                  From 768px a filter is as wide as what it says, between a floor that keeps a short
                  one steady and a ceiling past which a long one is cut: a fixed width cut the
                  longer Vietnamese values.
                */}
                <SelectTrigger
                  size="sm"
                  aria-label={filter.label}
                  className="flex-1 md:max-w-72 md:min-w-36 md:flex-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {loose.length > 0 && (
                    <SelectGroup>
                      {loose.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {groups.map((group, index) => (
                    <Fragment key={group.label}>
                      {(index > 0 || loose.length > 0) && <SelectSeparator />}
                      <SelectGroup>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.options.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </Fragment>
                  ))}
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
