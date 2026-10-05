"use client";

import { useQueryStates } from "nuqs";

import { DirectorySortSelect } from "@/components/composites/directory-sort";

import { talentSearch } from "./talent-search";

/** The order of the talent directory. It is the URL; a change returns to page 1. */
function TalentSort() {
  const [search, setSearch] = useQueryStates(talentSearch, { shallow: false });

  return (
    <DirectorySortSelect value={search.sort} onChange={(sort) => setSearch({ sort, page: null })} />
  );
}

export { TalentSort };
