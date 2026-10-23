"use client";

import { useEffect, useState } from "react";

type Option = { value: string; label: string };

/** How long typing rests before the options are asked again, in milliseconds. */
const SEARCH_DELAY_MS = 250;

/** What a combobox that asks the server needs besides its options: what to call as one types, and how the asking goes. */
type OptionSearch = {
  /** Asks for the options matching what is typed; a choice that fills the field with its name asks nothing. */
  onSearch: (text: string, reason?: string) => void;
  /** Whether the options shown are not yet the answer to what is typed. */
  searching: boolean;
  /** Whether asking for what is typed failed; the options shown are the last answer. */
  failed: boolean;
};

/**
 * The options of a combobox that the server finds by the text typed, for a list it gives only the
 * first page of, such as the organizations: a name past that page is found by typing it. The chosen
 * option stays among them, so its name stays shown when a later search does not find it, as in
 * Base UI's async combobox.
 *
 * @param find asks the server for the options matching a text, or for the first page with none;
 * a function that stays the same between renders, or `null` while nothing is to be asked yet
 * @param chosen the value chosen, or `""` when none is
 * @param known options whose names are already known, such as the chosen one as the page was read
 */
function useSearchedOptions(
  find: ((text: string | undefined) => Promise<Option[]>) | null,
  chosen: string,
  known: Option[] = [],
) {
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<{ text: string; options: Option[] } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [seen, setSeen] = useState<ReadonlyMap<string, Option>>(new Map());
  const asked = text.trim();

  useEffect(() => {
    if (find === null) {
      return;
    }
    let current = true;
    const timer = setTimeout(
      async () => {
        try {
          const options = await find(asked || undefined);
          if (current) {
            setAnswer({ text: asked, options });
            setFailedFor(null);
            setSeen((before) => new Map([...before, ...options.map((o) => [o.value, o] as const)]));
          }
        } catch {
          if (current) {
            setFailedFor(asked);
          }
        }
      },
      asked === "" ? 0 : SEARCH_DELAY_MS,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [find, asked]);

  const options = answer?.options ?? [];
  const kept = seen.get(chosen) ?? known.find(({ value }) => value === chosen);
  const failed = failedFor === asked;
  const search: OptionSearch = {
    onSearch: (typed, reason) => {
      if (reason !== "item-press") {
        setText(typed);
      }
    },
    searching: find !== null && !failed && answer?.text !== asked,
    failed,
  };
  return {
    options: kept && !options.some(({ value }) => value === chosen) ? [kept, ...options] : options,
    search,
    /** Whether the first page came back with nothing to choose from at all. */
    none: answer !== null && answer.text === "" && answer.options.length === 0,
  };
}

export { useSearchedOptions, type OptionSearch };
