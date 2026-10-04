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

import { auditActions, auditLogSearch, auditPeriods } from "./audit-log-search";

/** The value the action select shows when its filter is off; the URL then has no such parameter. */
const ALL = "all";

/**
 * Search and filters of the audit log. They are the URL: a change writes it and the server renders
 * the list again. Typing waits 300 ms before it asks, and any change returns to the newest events.
 */
function AuditLogToolbar() {
  const t = useTranslations("Admin.auditLog");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(auditLogSearch, { shallow: false, startTransition });
  const newest = { before: null, after: null };

  const periods = auditPeriods.map((value) => ({ value, label: t(`period.${value}`) }));
  const actions = [
    { value: ALL, label: t("filters.action.all") },
    ...auditActions.map((value) => ({ value, label: t(`action.${value}`) })),
  ];

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
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
              { q: event.target.value, ...newest },
              { limitUrlUpdates: event.target.value ? debounce(300) : undefined },
            )
          }
        />
      </InputGroup>
      <div className="flex gap-2">
        <Select
          items={periods}
          value={search.period}
          onValueChange={(value) =>
            setSearch({ period: auditPeriods.find((period) => period === value), ...newest })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label={t("filters.period.label")}
            className="flex-1 md:w-40 md:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {periods.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={actions}
          value={search.action ?? ALL}
          onValueChange={(value) =>
            setSearch({
              action: auditActions.find((action) => action === value) ?? null,
              ...newest,
            })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label={t("filters.action.label")}
            className="flex-1 md:w-60 md:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {actions.map((action) => (
                <SelectItem key={action.value} value={action.value}>
                  {action.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export { AuditLogToolbar };
