"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useId } from "react";

import { Button } from "@/components/actions/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useVocabulary } from "@/i18n/vocabulary";

import { availabilities, talentRoles } from "./talent-codes";
import { talentSearch } from "./talent-search";

type Facet = {
  key: string;
  label: string;
  /** The words of the select when the filter is off: "All roles". */
  all: string;
  value: string | null;
  options: { value: string; label: string }[];
  choose: (value: string | null) => void;
};

/**
 * The facets the directory can be narrowed by. Each is one parameter of the URL holding one value,
 * because that is what the API takes; a change returns to page 1.
 */
function useFacets(): Facet[] {
  const t = useTranslations("Talent.filters");
  const role = useVocabulary("talentRole");
  const availability = useVocabulary("availability");
  const [search, setSearch] = useQueryStates(talentSearch, { shallow: false });

  return [
    {
      key: "role",
      label: t("role.label"),
      all: t("role.all"),
      value: search.role,
      options: talentRoles.map((value) => ({ value, label: role(value) })),
      choose: (value) =>
        setSearch({ role: talentRoles.find((code) => code === value) ?? null, page: null }),
    },
    {
      key: "availability",
      label: t("availability.label"),
      all: t("availability.all"),
      value: search.availability,
      options: availabilities.map((value) => ({ value, label: availability(value) })),
      choose: (value) =>
        setSearch({
          availability: availabilities.find((code) => code === value) ?? null,
          page: null,
        }),
    },
  ];
}

/** One facet as a list of check boxes. Checking a value replaces the one checked before. */
function FacetGroup({ facet }: { facet: Facet }) {
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-3">
      <p id={labelId} className="text-sm">
        {facet.label}
      </p>
      {facet.options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-sm">
          {/* The page floor is tinted; the box itself stays white, as a field does. */}
          <span className="flex rounded-sm bg-background">
            <Checkbox
              checked={facet.value === option.value}
              onCheckedChange={(checked) => facet.choose(checked ? option.value : null)}
            />
          </span>
          {option.label}
        </label>
      ))}
    </div>
  );
}

function FacetGroups() {
  const facets = useFacets();

  return (
    <div className="flex flex-col gap-6">
      {facets.map((facet) => (
        <FacetGroup key={facet.key} facet={facet} />
      ))}
    </div>
  );
}

/** The filters beside the results on a wide screen. */
function TalentFilterSidebar() {
  const t = useTranslations("Talent.filters");

  return (
    <aside aria-label={t("open")} className="w-60 shrink-0 max-xl:hidden">
      <FacetGroups />
    </aside>
  );
}

/**
 * The filters above the results where the sidebar does not fit: a select per facet on a tablet, and
 * on a phone one button that opens them in a sheet.
 */
function TalentFilterBar() {
  const t = useTranslations("Talent.filters");
  const facets = useFacets();

  return (
    <div className="flex gap-2 xl:hidden">
      {facets.map((facet) => {
        const items = [{ value: null, label: facet.all }, ...facet.options];
        return (
          <div key={facet.key} className="w-48 rounded-lg bg-background max-md:hidden">
            <Select items={items} value={facet.value} onValueChange={facet.choose}>
              <SelectTrigger aria-label={facet.label} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {items.map((item) => (
                    <SelectItem key={item.value ?? ""} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        );
      })}
      <Sheet>
        <SheetTrigger
          render={<Button prominence="secondary" size="lg" className="flex-1 md:hidden" />}
        >
          <SlidersHorizontalIcon aria-hidden="true" />
          {t("open")}
        </SheetTrigger>
        <SheetContent side="bottom" closeLabel={t("close")} className="max-h-dvh">
          <SheetHeader>
            <SheetTitle>{t("open")}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4">
            <FacetGroups />
          </div>
          <SheetFooter>
            <SheetClose render={<Button size="lg" />}>{t("done")}</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { TalentFilterBar, TalentFilterSidebar };
