import { ChevronRightIcon, LayoutListIcon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { AdminProgramList, AdminProgramSummary } from "@/lib/api/generated";
import { adminProgramRoute } from "@/lib/site";

import { NewProgramDialog } from "./new-program-dialog";
import { programState } from "./program-labels";

/**
 * Admin › Programs: every program in any status, the newest first. A program opens on its Settings,
 * the one screen of a program so far.
 */
async function ProgramsAdminPage({ programs }: { programs: AdminProgramList }) {
  const [t, types, format, locale] = await Promise.all([
    getTranslations("Admin.programs"),
    getTranslations("Program.type"),
    getFormatter(),
    getLocale(),
  ]);

  /** "23 Sep – 15 Oct 2026, 23:59 ICT", or why there is no window. */
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

  const rows = programs.items.map((program) => {
    const state = programState(program);
    return {
      program,
      href: adminProgramRoute(program.id),
      kind: types(program.type),
      state: <Badge variant={state.variant}>{t(`state.${state.key}`)}</Badge>,
      window: window(program),
      quiet: state.key === "done" || !program.applications,
    };
  });
  const empty = rows.length === 0 && (
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
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="hidden text-sm text-muted-foreground md:block">{t("lead")}</p>
        </div>
        <NewProgramDialog locale={locale} />
      </div>

      {/* From 768px: a table. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.program")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead>{t("columns.window")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("columns.open")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.program.id} className="relative">
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  {/* The name is the row's link; it covers the whole row for the pointer. */}
                  <Link
                    href={row.href}
                    className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {row.program.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{row.kind}</span>
                </div>
              </TableCell>
              <TableCell>{row.state}</TableCell>
              <TableCell>
                <span className={row.quiet ? "text-muted-foreground" : undefined}>
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
              <TableCell colSpan={4}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>

      {/* Below 768px: one card a program. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.program.id}
            className="relative flex flex-col gap-1.5 rounded-xl border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
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
            <span className={row.quiet ? "text-xs text-muted-foreground" : "text-xs"}>
              {row.window}
            </span>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      <p className="text-sm text-muted-foreground">
        {t("count", { count: programs.items.length })}
      </p>
    </div>
  );
}

export { ProgramsAdminPage };
