import { SearchXIcon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTable, DataTableEmpty, DataTableFooter } from "@/components/composites/data-table";
import { Person } from "@/components/composites/person";
import { Status } from "@/components/composites/status";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AccountList, AccountSummary, Me } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { AccountRowActions } from "./account-row-actions";
import { accountsSearch, type AccountsSearch } from "./accounts-search";
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
    <DataTableEmpty
      icon={<SearchXIcon aria-hidden="true" />}
      title={t("empty.title")}
      description={t("empty.description")}
    >
      <Button prominence="secondary" size="sm" href={siteRoutes.adminAccounts}>
        {t("empty.clear")}
      </Button>
    </DataTableEmpty>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>
      <AccountsToolbar />

      {/* From 768px: a table. The Created column gives way first. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.account")}</TableHead>
            <TableHead>{t("columns.role")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead>{t("columns.lastSignIn")}</TableHead>
            <TableHead className="hidden xl:table-cell">{t("columns.created")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("columns.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.account.id}>
              <TableCell>{row.person}</TableCell>
              <TableCell>{row.role}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>
                <span className={row.disabled ? "text-muted-foreground" : undefined}>
                  {row.lastSignIn}
                </span>
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <span className="text-muted-foreground">{row.created}</span>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">{row.actions}</div>
              </TableCell>
            </TableRow>
          ))}
          {empty && (
            <TableRow>
              <TableCell colSpan={6}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>

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
