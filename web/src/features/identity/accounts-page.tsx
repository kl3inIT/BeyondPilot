import { SearchXIcon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty, DataTableFooter } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { Person } from "@/components/composites/person";
import { Status } from "@/components/composites/status";
import { AdminPageTitle } from "@/components/layout/admin-icons";
import { Badge } from "@/components/ui/badge";
import type { AccountList, AccountSummary, Me } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { AccountRowActions } from "./account-row-actions";
import { accountsSearch, type AccountsSearch, accountSortKeys } from "./accounts-search";
import { AccountsToolbar } from "./accounts-toolbar";

const address = createSerializer(accountsSearch);

type AccountsPageProps = {
  accounts: AccountList;
  search: AccountsSearch;
  /** The operator looking at the list; their own row carries no actions. */
  me: Me;
};

/**
 * Admin › Accounts: everyone who has signed in, with the role and the status an operator may
 * change. The list arrives already read; search, filters and paging are the URL.
 */
async function AccountsPage({ accounts, search, me }: AccountsPageProps) {
  const [t, format, locale] = await Promise.all([
    getTranslations("Admin.accounts"),
    getFormatter(),
    getLocale(),
  ]);
  const today = format.dateTime(new Date(), { dateStyle: "short" });

  /** "Today, 21:36" for a sign-in of today in Vietnam time, "3 Oct, 14:32" before that. */
  function lastSignIn(account: AccountSummary) {
    if (!account.lastSignInAt) {
      return t("never");
    }
    const at = new Date(account.lastSignInAt);
    const time = format.dateTime(at, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return format.dateTime(at, { dateStyle: "short" }) === today
      ? t("today", { time })
      : t("dayAndTime", { day: format.dateTime(at, { day: "numeric", month: "short" }), time });
  }

  const rows = accounts.items.map((account) => {
    const you = account.id === me.id;
    const disabled = account.status === "disabled";
    return {
      account,
      disabled,
      person: (
        <Person
          name={account.displayName ?? null}
          email={account.email}
          muted={disabled}
          badge={you && <Badge variant="outline">{t("you")}</Badge>}
        />
      ),
      role:
        account.role === "operator" ? (
          <Badge variant="outline">{t("role.operator")}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">{t("role.user")}</span>
        ),
      status: (
        <Status tone={disabled ? "neutral" : "success"}>
          {t(disabled ? "status.disabled" : "status.active")}
        </Status>
      ),
      lastSignIn: lastSignIn(account),
      created: format.dateTime(new Date(account.createdAt), { dateStyle: "medium" }),
      // An operator does not disable or demote themselves; the backend refuses it as well.
      actions: you ? null : <AccountRowActions account={account} />,
    };
  });

  const pages = Math.max(1, Math.ceil(accounts.total / accounts.pageSize));
  /** The address of a page of this list, with the search and filters kept. */
  const pageHref = (number: number) =>
    address(siteRoutes.adminAccounts, { ...search, page: number });
  const empty = rows.length === 0 && (
    <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("empty.title")}>
      <Button prominence="secondary" size="sm" href={siteRoutes.adminAccounts}>
        {t("empty.clear")}
      </Button>
    </DataTableEmpty>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageTitle destination="accounts">{t("title")}</AdminPageTitle>
      <AccountsToolbar />

      {/* From 768px: a table. The Created column gives way first. */}
      <DataTableRows
        sortKeys={accountSortKeys}
        className="hidden md:flex"
        columns={[
          { id: "name", header: t("columns.account") },
          { id: "role", header: t("columns.role") },
          { id: "status", header: t("columns.status") },
          { id: "lastSignIn", header: t("columns.lastSignIn"), layout: { descFirst: true } },
          { id: "created", header: t("columns.created"), layout: { from: "xl", descFirst: true } },
          { id: "actions", header: <span className="sr-only">{t("columns.actions")}</span> },
        ]}
        rows={rows.map((row) => ({
          id: row.account.id,
          cells: {
            name: row.person,
            role: row.role,
            status: row.status,
            lastSignIn: (
              <span className={row.disabled ? "text-muted-foreground" : undefined}>
                {row.lastSignIn}
              </span>
            ),
            created: <span className="text-muted-foreground">{row.created}</span>,
            actions: <div className="flex justify-end">{row.actions}</div>,
          },
        }))}
        empty={empty}
      />

      {/* Below 768px: one stacked row per account, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {rows.map((row) => (
          <li key={row.account.id} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
            <div className="flex items-center justify-between gap-2">
              {row.person}
              {row.actions}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-11">
              {row.role}
              {row.status}
              <span className="text-xs text-muted-foreground">{row.lastSignIn}</span>
            </div>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      <DataTableFooter
        count={t("count", { count: accounts.total })}
        page={accounts.page}
        pages={pages}
        href={pageHref}
        labels={{
          navigation: t("pagination.label"),
          previous: t("pagination.previous"),
          next: t("pagination.next"),
          goToPrevious: t("pagination.goToPrevious"),
          goToNext: t("pagination.goToNext"),
          page: (number) => t("pagination.page", { page: number }),
        }}
      />
    </div>
  );
}

export { AccountsPage };
