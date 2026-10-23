"use client";

import { useEffect, useState } from "react";

type Option = { value: string; label: string };

/** How long typing rests before the options are asked again, in milliseconds. */
const SEARCH_DELAY_MS = 250;

/**
 * The options of a `ComboboxField` that the server finds by the text typed, for a list it gives
 * only the first page of, such as the organizations: a name past that page is found by typing it.
 * The chosen option stays among them, so its name stays shown when a later search does not find it.
 *
 * @param find asks the server for the options matching a text, or for the first page with none;
 * a function that stays the same between renders, or `null` while nothing is to be asked yet
 * @param chosen the value chosen, or `""` when none is
 */
function useSearchedOptions(
  find: ((text: string | undefined) => Promise<Option[]>) | null,
  chosen: string,
) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<Option[] | null>(null);
  const [known, setKnown] = useState<ReadonlyMap<string, Option>>(new Map());

  useEffect(() => {
    if (find === null) {
      return;
    }
    let current = true;
    const timer = setTimeout(
      async () => {
        try {
          const options = await find(text.trim() || undefined);
          if (current) {
            setFound(options);
            setKnown(
              (before) => new Map([...before, ...options.map((o) => [o.value, o] as const)]),
            );
          }
        } catch {
          // A failed search leaves the list as it was; the operator types again.
        }
      },
      text.trim() === "" ? 0 : SEARCH_DELAY_MS,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [find, text]);

  const options = found ?? [];
  const kept = known.get(chosen);
  return {
    options: kept && !options.some(({ value }) => value === chosen) ? [kept, ...options] : options,
    /** Asks for the options matching what is typed. */
    search: setText,
    /** Whether the first page came back with nothing to choose from at all. */
    none: found !== null && found.length === 0 && text.trim() === "",
  };
}

export { useSearchedOptions };
