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

import { accountsSearch } from "./accounts-search";

/** The value a select shows when its filter is off; the URL then has no such parameter. */
const ALL = "all";

/**
 * Search and filters of the accounts list. They are the URL: a change writes it and the server
 * renders the list again. Typing waits 300 ms before it asks, and any change returns to page 1.
 */
function AccountsToolbar() {
  const t = useTranslations("Admin.accounts");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(accountsSearch, { shallow: false, startTransition });

  const statuses = [
    { value: ALL, label: t("filters.status.all") },
    { value: "active", label: t("status.active") },
    { value: "disabled", label: t("status.disabled") },
  ];
  const roles = [
    { value: ALL, label: t("filters.role.all") },
    { value: "user", label: t("role.user") },
    { value: "operator", label: t("role.operator") },
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
              { q: event.target.value, page: null },
              { limitUrlUpdates: event.target.value ? debounce(300) : undefined },
            )
          }
        />
      </InputGroup>
      <div className="flex gap-2">
        <Select
          items={statuses}
          value={search.status ?? ALL}
          onValueChange={(value) =>
            setSearch({
              status: value === "active" || value === "disabled" ? value : null,
              page: null,
            })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label={t("filters.status.label")}
            className="flex-1 md:w-40 md:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={roles}
          value={search.role ?? ALL}
          onValueChange={(value) =>
            setSearch({ role: value === "user" || value === "operator" ? value : null, page: null })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label={t("filters.role.label")}
            className="flex-1 md:w-36 md:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {roles.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export { AccountsToolbar };
