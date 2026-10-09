"use client";

import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  usageCallsSearch,
  usageGroupings,
  usageOutcomes,
  usageOverviewSearch,
  usagePeriods,
} from "./usage-search";

/** The value a select shows when its filter is off; the URL then has no such parameter. */
const ALL = "all";

/**
 * The period the page covers, in its head. It is the URL: a change writes it and the server
 * renders the page again. In the log a change also returns to page 1.
 */
function UsagePeriodSwitch() {
  const t = useTranslations("Admin.aiUsage");
  const [, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(
    { period: usageCallsSearch.period, page: usageCallsSearch.page },
    { shallow: false, startTransition },
  );

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={t("period.label")}
      value={[search.period]}
      onValueChange={(chosen) => {
        const period = usagePeriods.find((each) => each === chosen[0]);
        if (period) {
          void setSearch({ period, page: null });
        }
      }}
    >
      {usagePeriods.map((period) => (
        <ToggleGroupItem key={period} value={period}>
          {t(`period.${period}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** What the table of the Overview groups the calls by. */
function UsageGroupingSwitch() {
  const t = useTranslations("Admin.aiUsage.breakdown");
  const [, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(usageOverviewSearch, {
    shallow: false,
    scroll: false,
    startTransition,
  });

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={t("byLabel")}
      value={[search.by]}
      onValueChange={(chosen) => {
        const by = usageGroupings.find((each) => each === chosen[0]);
        if (by) {
          void setSearch({ by });
        }
      }}
    >
      {usageGroupings.map((by) => (
        <ToggleGroupItem key={by} value={by}>
          {t(`by.${by}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * The filters of the Calls log: what was called in the period, each as a select. They are the URL,
 * and any change returns to page 1.
 */
function UsageCallsToolbar({
  tasks,
  providers,
  models,
}: {
  /** The tasks called in the period, each with the name an operator reads. */
  tasks: { value: string; label: string }[];
  providers: string[];
  models: string[];
}) {
  const t = useTranslations("Admin.aiUsage.calls");
  const [, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(usageCallsSearch, {
    shallow: false,
    startTransition,
  });
  const named = (names: string[]) => names.map((name) => ({ value: name, label: name }));

  const filters = [
    {
      key: "task",
      label: t("filters.taskLabel"),
      items: [{ value: ALL, label: t("filters.task") }, ...tasks],
      value: search.task ?? ALL,
      change: (value: string) => setSearch({ task: value === ALL ? null : value, page: null }),
    },
    {
      key: "provider",
      label: t("filters.providerLabel"),
      items: [{ value: ALL, label: t("filters.provider") }, ...named(providers)],
      value: search.provider ?? ALL,
      change: (value: string) => setSearch({ provider: value === ALL ? null : value, page: null }),
    },
    {
      key: "model",
      label: t("filters.modelLabel"),
      items: [{ value: ALL, label: t("filters.model") }, ...named(models)],
      value: search.model ?? ALL,
      change: (value: string) => setSearch({ model: value === ALL ? null : value, page: null }),
    },
    {
      key: "outcome",
      label: t("filters.outcomeLabel"),
      items: [
        { value: ALL, label: t("filters.outcome") },
        ...usageOutcomes.map((value) => ({ value, label: t(`outcome.${value}`) })),
      ],
      value: search.outcome ?? ALL,
      change: (value: string) =>
        setSearch({
          outcome: usageOutcomes.find((outcome) => outcome === value) ?? null,
          page: null,
        }),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:flex">
      {filters.map((filter) => (
        <Select
          key={filter.key}
          items={filter.items}
          value={filter.value}
          onValueChange={(value) => void filter.change(String(value))}
        >
          <SelectTrigger size="sm" aria-label={filter.label} className="w-full md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {filter.items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}

export { UsageCallsToolbar, UsageGroupingSwitch, UsagePeriodSwitch };
