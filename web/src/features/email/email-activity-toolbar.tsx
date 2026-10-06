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

import { emailActivitySearch, emailKinds, emailPeriods, emailStatuses } from "./email-search";

/** The value a select shows when its filter is off; the URL then has no such parameter. */
const ALL = "all";

/**
 * Search and filters of the email log. They are the URL: a change writes it and the server renders
 * the list again. Typing waits 300 ms before it asks, and any change returns to the newest emails.
 */
function EmailActivityToolbar() {
  const t = useTranslations("Admin.email");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(emailActivitySearch, {
    shallow: false,
    startTransition,
  });
  const newest = { before: null, after: null };

  const periods = emailPeriods.map((value) => ({ value, label: t(`activity.period.${value}`) }));
  const kinds = [
    { value: ALL, label: t("activity.filters.kind.all") },
    ...emailKinds.map((value) => ({ value, label: t(`kinds.${value}.name`) })),
  ];
  const statuses = [
    { value: ALL, label: t("activity.filters.status.all") },
    ...emailStatuses.map((value) => ({ value, label: t(`status.${value}`) })),
  ];

  const selects = [
    {
      key: "period",
      label: t("activity.filters.period.label"),
      items: periods,
      value: search.period,
      width: "md:w-36",
      change: (value: string) =>
        setSearch({ period: emailPeriods.find((period) => period === value), ...newest }),
    },
    {
      key: "kind",
      label: t("activity.filters.kind.label"),
      items: kinds,
      value: search.kind ?? ALL,
      width: "md:w-56",
      change: (value: string) =>
        setSearch({ kind: emailKinds.find((kind) => kind === value) ?? null, ...newest }),
    },
    {
      key: "status",
      label: t("activity.filters.status.label"),
      items: statuses,
      value: search.status ?? ALL,
      width: "md:w-40",
      change: (value: string) =>
        setSearch({
          status: emailStatuses.find((status) => status === value) ?? null,
          ...newest,
        }),
    },
  ];

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <InputGroup className="md:flex-1">
        <InputGroupAddon>
          {loading ? <Spinner /> : <SearchIcon aria-hidden="true" />}
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label={t("activity.search")}
          placeholder={t("activity.search")}
          value={search.q}
          maxLength={100}
          onChange={(event) =>
            setSearch(
              { q: event.target.value, ...newest },
              { limitUrlUpdates: event.target.value ? debounce(300) : undefined },
            )
          }
        />
      </InputGroup>
      <div className="flex flex-wrap gap-2">
        {selects.map((select) => (
          <Select
            key={select.key}
            items={select.items}
            value={select.value}
            onValueChange={(value) => value !== null && select.change(String(value))}
          >
            <SelectTrigger
              size="sm"
              aria-label={select.label}
              className={`flex-1 md:flex-none ${select.width}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {select.items.map((item) => (
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

export { EmailActivityToolbar };
