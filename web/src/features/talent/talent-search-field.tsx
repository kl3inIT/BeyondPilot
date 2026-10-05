"use client";

import { useTranslations } from "next-intl";
import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";

import { DirectorySearch } from "@/components/composites/directory-search";

import { talentSearch } from "./talent-search";

/** How long the search waits after the last keystroke before it asks the server. */
const SEARCH_DELAY_MS = 300;

/**
 * The search of the public directory. It is the URL: typing waits 300 ms, then the server reads the
 * list again from page 1 (docs/conventions.md › Lists).
 */
function TalentSearchField() {
  const t = useTranslations("Talent.filters");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(talentSearch, { shallow: false, startTransition });

  return (
    <DirectorySearch
      label={t("search")}
      value={search.q}
      loading={loading}
      onChange={(q) =>
        setSearch({ q, page: null }, { limitUrlUpdates: q ? debounce(SEARCH_DELAY_MS) : undefined })
      }
    />
  );
}

export { TalentSearchField };
