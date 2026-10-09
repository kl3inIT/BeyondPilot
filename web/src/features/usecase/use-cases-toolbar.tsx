"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";

import { TextButton } from "@/components/actions/text-button";
import { ChoiceCombobox } from "@/components/composites/choice-combobox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { useVocabulary } from "@/i18n/vocabulary";
import { useCaseIndustries } from "./admin-use-case-codes";
import { useCaseSorts, useCasesSearch } from "./use-cases-search";

function isIndustry(value: string): value is (typeof useCaseIndustries)[number] {
  return useCaseIndustries.some((industry) => industry === value);
}

/**
 * Search, order and industry of the use case list. They are the URL: a change writes it and the
 * server renders the list again. Typing waits 300 ms before it asks, and any change returns to
 * page 1.
 */
function UseCasesToolbar() {
  const t = useTranslations("UseCases");
  const industryName = useVocabulary("industry");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(useCasesSearch, { shallow: false, startTransition });

  const sorts = useCaseSorts.map((sort) => ({ value: sort, label: t(`sort.${sort}`) }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <InputGroup className="md:flex-1">
          <InputGroupAddon>
            {loading ? <Spinner /> : <SearchIcon aria-hidden="true" />}
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={search.q}
            maxLength={100}
            onChange={(event) =>
              setSearch(
                { q: event.target.value, page: null },
                { limitUrlUpdates: event.target.value ? debounce(300) : undefined },
              )
            }
          />
        </InputGroup>
        <div className="flex items-start gap-2 md:w-72">
          <div className="min-w-0 flex-1">
            <ChoiceCombobox
              label={t("industry.label")}
              placeholder={t("industry.placeholder")}
              emptyLabel={t("industry.empty")}
              removeLabel={(industry) => t("industry.remove", { industry })}
              options={useCaseIndustries.map((value) => ({ value, label: industryName(value) }))}
              value={search.industry}
              onValueChange={(industry) =>
                setSearch({ industry: industry.filter(isIndustry), page: null })
              }
            />
          </div>
          {search.industry.length > 0 && (
            <TextButton
              className="self-start"
              size="sm"
              onClick={() => setSearch({ industry: null, page: null })}
            >
              {t("industry.clear")}
            </TextButton>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground" aria-hidden="true">
            {t("sort.label")}
          </span>
          <Select
            items={sorts}
            value={search.sort}
            onValueChange={(value) =>
              setSearch({
                sort: useCaseSorts.find((sort) => sort === value) ?? null,
                page: null,
              })
            }
          >
            <SelectTrigger size="sm" aria-label={t("sort.label")} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {sorts.map((sort) => (
                  <SelectItem key={sort.value} value={sort.value}>
                    {sort.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export { UseCasesToolbar };
