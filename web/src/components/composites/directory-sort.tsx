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
  value: DirectorySort;
  onChange: (value: DirectorySort) => void;
  /** Optional layout classes for a directory-specific toolbar. */
  className?: string;
};

/**
 * The order of a public directory, beside its count. The directory owns the value, which is its
 * URL. The select sits on a white ground because a directory's floor may be tinted.
 */
function DirectorySortSelect({ value, onChange, className }: DirectorySortSelectProps) {
  const t = useTranslations("Lists.sort");
  const items = directorySorts.map((sort) => ({ value: sort, label: t(sort) }));

  return (
    <div className="rounded-lg bg-background">
      <Select
        items={items}
        value={value}
        onValueChange={(next) => onChange(directorySorts.find((sort) => sort === next) ?? value)}
      >
        <SelectTrigger aria-label={t("label")} className={className}>
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
