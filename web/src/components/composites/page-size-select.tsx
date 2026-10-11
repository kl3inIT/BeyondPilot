"use client";

import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pageSize, tablePageSizes } from "@/lib/page-size";

/** The size and every place in the list a change of size leaves: the page, or the cursor of a log. */
const parsers = {
  size: pageSize,
  page: parseAsInteger,
  before: parseAsString,
  after: parseAsString,
};

type PageSizeSelectProps = {
  /** How many items the page shown holds. */
  size: number;
  /** The sizes offered; the size shown is always among them. */
  sizes?: readonly number[];
  /** Matching records, when known; cursor logs leave this absent. */
  total?: number;
};

/**
 * How many items a page of a list holds. It is the URL like the search and the filters: a change
 * writes `size` and returns to the start of the list (docs/conventions.md › Lists).
 */
function PageSizeSelect({ size, sizes = tablePageSizes, total }: PageSizeSelectProps) {
  const t = useTranslations("Lists.pageSize");
  const [, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(parsers, { shallow: false, startTransition });
  const items = [...new Set([...sizes, size])]
    .sort((a, b) => a - b)
    .map((value) => ({ value: String(value), label: String(value) }));

  if (total !== undefined && total <= Math.min(sizes[0], size) && search.size === null) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden="true">{t("label")}</span>
      <Select
        items={items}
        value={String(size)}
        onValueChange={(value) =>
          setSearch({ size: Number(value), page: null, before: null, after: null })
        }
      >
        <SelectTrigger size="sm" aria-label={t("label")} className="w-18">
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
    </div>
  );
}

export { PageSizeSelect };
