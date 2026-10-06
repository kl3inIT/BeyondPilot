import { SearchXIcon, UsersIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import { Person } from "@/components/composites/person";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminTalentList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { adminTalentSearch, type AdminTalentSearch } from "./talent-search";
import { TalentStatus } from "./talent-status";
import { TalentToolbar } from "./talent-toolbar";

const address = createSerializer(adminTalentSearch);

type AdminTalentListPageProps = {
  talent: AdminTalentList;
  search: AdminTalentSearch;
};

/**
 * Admin › Talent: every talent profile that was submitted, those waiting for review first and the
 * longest wait on top. The list arrives already read; search, the filter and paging are the URL.
 */
function AdminTalentListPage({ talent, search }: AdminTalentListPageProps) {
  const t = useTranslations("Admin.talent");
  const format = useFormatter();
  const locale = useLocale();

  const rows = talent.items.map((profile) => ({
    id: profile.id,
    href: `${siteRoutes.adminTalent}/${profile.id}`,
    name: profile.name,
    person: <Person name={profile.name} email={profile.email} />,
    headline: profile.headline ?? "",
    status: <TalentStatus status={profile.status} />,
    // A record that waits says for how long; a decided one keeps the day it was sent.
    submitted: !profile.submittedAt
      ? ""
      : profile.status === "submitted"
        ? t("waitingSince", { time: format.relativeTime(new Date(profile.submittedAt)) })
        : format.dateTime(new Date(profile.submittedAt), { dateStyle: "medium" }),
    waiting: profile.status === "submitted",
  }));

  const filtered = search.q.trim() !== "" || search.status !== null;
  const empty =
    rows.length > 0 ? null : search.q.trim() === "" && search.status === "submitted" ? (
      <DataTableEmpty
        icon={<UsersIcon aria-hidden="true" />}
        title={t("queueEmpty.title")}
        description={t("queueEmpty.description")}
      >
        <Button prominence="secondary" size="sm" href={siteRoutes.admin}>
          {t("queueEmpty.home")}
        </Button>
      </DataTableEmpty>
    ) : filtered ? (
      <DataTableEmpty
        icon={<SearchXIcon aria-hidden="true" />}
        title={t("noMatch.title")}
        description={t("noMatch.description")}
      >
        <Button prominence="secondary" size="sm" href={siteRoutes.adminTalent}>
          {t("noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty
        icon={<UsersIcon aria-hidden="true" />}
        title={t("empty.title")}
        description={t("empty.description")}
      />
    );
  const open = (row: (typeof rows)[number]) => (
    <TextButton href={row.href} aria-label={t("openNamed", { name: row.name })}>
      {t(row.waiting ? "review.open" : "open")}
    </TextButton>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        <TextButton href={siteRoutes.adminTalentReported}>{t("reported.link")}</TextButton>
      </div>
      <TalentToolbar />

      {/* From 768px: a table. The Headline column gives way first. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.person")}</TableHead>
            <TableHead className="hidden xl:table-cell">{t("columns.headline")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead>{t("columns.submitted")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("columns.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.person}</TableCell>
              <TableCell className="hidden max-w-xs xl:table-cell">
                <span className="line-clamp-1 text-muted-foreground">{row.headline}</span>
              </TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>
                <span className="text-muted-foreground">{row.submitted}</span>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">{open(row)}</div>
              </TableCell>
            </TableRow>
          ))}
          {empty && (
            <TableRow>
              <TableCell colSpan={5}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>

      {/* Below 768px: one stacked row per profile, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              {row.person}
              {open(row)}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-11">
              {row.status}
              <span className="text-xs text-muted-foreground">{row.submitted}</span>
            </div>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      <ListFooter
        count={t("count", { count: talent.total })}
        page={talent.page}
        pageSize={talent.pageSize}
        total={talent.total}
        href={(page) => address(siteRoutes.adminTalent, { ...search, page })}
      />
    </div>
  );
}

export { AdminTalentListPage };
