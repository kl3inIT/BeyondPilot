"use client";

import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { directorySorts, type DirectorySort } from "@/lib/directory-sort";

type DirectorySortSelectProps = {
  value: DirectorySort | null;
  searching?: boolean;
  /** The list has no order to choose now; the select keeps its place and cannot be opened. */
  disabled?: boolean;
  onChange: (value: DirectorySort | null) => void;
};

/**
 * The order of a public directory, of one width whatever it reads. The directory owns the value,
 * which is its URL. The select sits on a white ground because a directory's floor may be tinted.
 */
function DirectorySortSelect({
  value,
  searching = false,
  disabled = false,
  onChange,
}: DirectorySortSelectProps) {
  const t = useTranslations("Lists.sort");
  const items = [
    ...(searching ? [{ value: "relevance", label: t("relevance") }] : []),
    ...directorySorts.map((sort) => ({ value: sort, label: t(sort) })),
  ];

  return (
    <div className="rounded-lg bg-background md:w-44">
      <Select
        items={items}
        disabled={disabled}
        value={value ?? (searching ? "relevance" : directorySorts[0])}
        onValueChange={(next) => onChange(directorySorts.find((sort) => sort === next) ?? null)}
      >
        <SelectTrigger size="lg" aria-label={t("label")} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
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

export { DirectorySortSelect };
