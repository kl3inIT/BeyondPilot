"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";

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
import type { McpCallApp } from "@/lib/api/generated";

import { mcpActivitySearch, mcpOutcomes, mcpPeriods } from "./admin-mcp-search";

/** The value a select shows when its filter is off; the URL then has no such parameter. */
const ALL = "all";

/**
 * Search and filters of the MCP activity. They are the URL: a change writes it and the server
 * renders the list again. Typing waits 300 ms before it asks, and any change returns to page 1.
 */
function McpActivityToolbar({ apps, tools }: { apps: McpCallApp[]; tools: string[] }) {
  const t = useTranslations("Admin.mcp.activity");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(mcpActivitySearch, {
    shallow: false,
    startTransition,
  });
  const first = { page: null };

  const periods = mcpPeriods.map((value) => ({ value, label: t(`period.${value}`) }));
  const appItems = [
    { value: ALL, label: t("filters.app") },
    ...apps.map((app) => ({ value: app.clientId, label: app.name })),
  ];
  const toolItems = [
    { value: ALL, label: t("filters.tool") },
    ...tools.map((tool) => ({ value: tool, label: tool })),
  ];
  const outcomeItems = [
    { value: ALL, label: t("filters.outcome") },
    ...mcpOutcomes.map((value) => ({ value, label: t(`outcome.${value}`) })),
  ];
  const filters = [
    {
      key: "period",
      label: t("filters.periodLabel"),
      items: periods,
      value: search.period,
      change: (value: string) =>
        setSearch({ period: mcpPeriods.find((period) => period === value), ...first }),
    },
    {
      key: "app",
      label: t("filters.appLabel"),
      items: appItems,
      value: search.app ?? ALL,
      change: (value: string) => setSearch({ app: value === ALL ? null : value, ...first }),
    },
    {
      key: "tool",
      label: t("filters.toolLabel"),
      items: toolItems,
      value: search.tool ?? ALL,
      change: (value: string) => setSearch({ tool: value === ALL ? null : value, ...first }),
    },
    {
      key: "outcome",
      label: t("filters.outcomeLabel"),
      items: outcomeItems,
      value: search.outcome ?? ALL,
      change: (value: string) =>
        setSearch({ outcome: mcpOutcomes.find((outcome) => outcome === value) ?? null, ...first }),
    },
  ];

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <InputGroup className="lg:flex-1">
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
              { q: event.target.value, ...first },
              { limitUrlUpdates: event.target.value ? debounce(300) : undefined },
            )
          }
        />
      </InputGroup>
      <div className="grid grid-cols-2 gap-2 md:flex">
        {filters.map((filter) => (
          <Select
            key={filter.key}
            items={filter.items}
            value={filter.value}
            onValueChange={(value) => filter.change(String(value))}
          >
            <SelectTrigger size="sm" aria-label={filter.label} className="w-full md:w-36">
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
    </div>
  );
}

export { McpActivityToolbar };
