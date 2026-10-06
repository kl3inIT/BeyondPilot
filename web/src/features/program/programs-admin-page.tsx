import { ChevronRightIcon, LayoutListIcon, SearchXIcon } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { AdminPageTitle } from "@/components/layout/admin-icons";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { AdminProgramSummary } from "@/lib/api/generated";
import { adminProgramRoute, siteRoutes } from "@/lib/site";
import { publicFileUrl } from "@/lib/storage/upload";

import { NewProgramDialog } from "./new-program-dialog";
import { programFormatter } from "./program-format";
import { programState } from "./program-labels";
import type { narrowPrograms, ProgramsSearch } from "./programs-search";
import { ProgramsToolbar } from "./programs-toolbar";

/** A program's cover, small, beside its name; an empty frame until it has one. */
function Thumbnail({ program, alt }: { program: AdminProgramSummary; alt: string }) {
  return program.coverFileId ? (
    <Image
      src={publicFileUrl(program.coverFileId)}
      alt={alt}
      width={64}
      height={40}
      unoptimized
      className="h-10 w-16 shrink-0 rounded-md border object-cover"
    />
  ) : (
    <span aria-hidden="true" className="h-10 w-16 shrink-0 rounded-md border bg-muted" />
  );
}

type ProgramsAdminPageProps = {
  list: ReturnType<typeof narrowPrograms>;
  search: ProgramsSearch;
};

/**
 * Admin › Programs: every program in any status, the newest first, narrowed by state and by name.
 * A program opens on its Settings, the one screen of a program so far.
 */
async function ProgramsAdminPage({ list, search }: ProgramsAdminPageProps) {
  const [t, types, locale] = await Promise.all([
    getTranslations("Admin.programs"),
    getTranslations("Program.type"),
    getLocale(),
  ]);
  const format = programFormatter(locale);

  /** "23 Sept – 15 Oct 2026, 23:59 ICT", or why there is no window. */
  function window(program: AdminProgramSummary) {
    const applications = program.applications;
    if (!applications) {
      return t("noApplications");
    }
    const closes = new Date(applications.closesAt);
    return t("window", {
      opens: format.dateTime(new Date(applications.opensAt), { day: "numeric", month: "short" }),
      closes: format.dateTime(closes, { day: "numeric", month: "short", year: "numeric" }),
      time: format.dateTime(closes, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    });
  }

  /** "23 Sep – 5 Dec 2026", one day alone, or that the days are not set. */
  function runs(program: AdminProgramSummary) {
    if (!program.startsOn || !program.endsOn) {
      return t("noDays");
    }
    const starts = new Date(`${program.startsOn}T00:00:00+07:00`);
    const ends = new Date(`${program.endsOn}T00:00:00+07:00`);
    return program.startsOn === program.endsOn
      ? format.dateTime(starts, { day: "numeric", month: "short", year: "numeric" })
      : format.dateTimeRange(starts, ends, { day: "numeric", month: "short", year: "numeric" });
  }

  const rows = list.items.map((program) => {
    const state = programState(program);
    return {
      program,
      href: adminProgramRoute(program.id),
      kind: types(program.type),
      state: <Badge variant={state.variant}>{t(`state.${state.key}`)}</Badge>,
      runs: runs(program),
      window: window(program),
      quietWindow: state.key === "done" || !program.applications,
    };
  });

  const narrowed = Boolean(search.state || search.q.trim());
  const empty =
    rows.length > 0 ? null : narrowed ? (
      <DataTableEmpty
        icon={<SearchXIcon aria-hidden="true" />}
        title={t("noMatch.title")}
        description={t("noMatch.description")}
      >
        <Button prominence="secondary" size="sm" href={siteRoutes.adminPrograms}>
          {t("noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty
        icon={<LayoutListIcon aria-hidden="true" />}
        title={t("empty.title")}
        description={t("empty.description")}
      />
    );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <AdminPageTitle destination="programs">{t("title")}</AdminPageTitle>
          <p className="hidden text-sm text-muted-foreground md:block">{t("lead")}</p>
        </div>
        <NewProgramDialog locale={locale} />
      </div>
      <ProgramsToolbar counts={list.counts} total={list.total} />

      {/* From 768px: a table. The window gives way to the days on narrower desktops. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.program")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead>{t("columns.runs")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("columns.window")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("columns.open")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.program.id} className="relative">
              <TableCell>
                <div className="flex items-center gap-3">
                  <Thumbnail program={row.program} alt="" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {/* The name is the row's link; it covers the whole row for the pointer. */}
                    <Link
                      href={row.href}
                      className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                    >
                      {row.program.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {[row.kind, row.program.partnerName].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>{row.state}</TableCell>
              <TableCell>
                <span className={row.program.startsOn ? undefined : "text-muted-foreground"}>
                  {row.runs}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className={row.quietWindow ? "text-muted-foreground" : undefined}>
                  {row.window}
                </span>
              </TableCell>
              <TableCell className="w-8">
                <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
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

      {/* Below 768px: one card a program. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.program.id}
            className="relative flex flex-col gap-2 rounded-xl border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <Thumbnail program={row.program} alt="" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link
                  href={row.href}
                  className="text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                >
                  {row.program.name}
                </Link>
                <span className="text-xs text-muted-foreground">{row.kind}</span>
              </div>
              {row.state}
            </div>
            <span className={row.program.startsOn ? "text-xs" : "text-xs text-muted-foreground"}>
              {row.runs}
            </span>
            <span className={row.quietWindow ? "text-xs text-muted-foreground" : "text-xs"}>
              {row.window}
            </span>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      <p className="text-sm text-muted-foreground">
        {narrowed
          ? t("countOf", { count: rows.length, total: list.total })
          : t("count", { count: list.total })}
      </p>
    </div>
  );
}

export { ProgramsAdminPage };
