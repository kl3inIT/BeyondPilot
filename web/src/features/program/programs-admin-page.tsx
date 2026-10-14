import { ChevronRightIcon, LayoutListIcon, SearchXIcon } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { FeaturedBadge } from "@/components/composites/featured-badge";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Badge } from "@/components/ui/badge";
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
      opens: format.dateTime(new Date(applications.opensAt), "day"),
      closes: format.dateTime(closes, "date"),
      time: format.dateTime(closes, "time"),
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
      ? format.dateTime(starts, "date")
      : format.dateTimeRange(starts, ends, "date");
  }

  const rows = list.items.map((program) => {
    const state = programState(program);
    return {
      program,
      href: adminProgramRoute(program.id),
      kind: types(program.type),
      state: (
        <span className="flex flex-col items-start gap-1">
          <Badge variant={state.variant}>{t(`state.${state.key}`)}</Badge>
          {program.featuredAt && <FeaturedBadge>{t("featured")}</FeaturedBadge>}
        </span>
      ),
      runs: runs(program),
      window: window(program),
      quietWindow: state.key === "done" || !program.applications,
    };
  });

  const narrowed = Boolean(search.state || search.q.trim());
  const empty =
    rows.length > 0 ? null : narrowed ? (
      <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
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
      <AdminPageHeader
        destination="programs"
        title={t("title")}
        actions={<NewProgramDialog locale={locale} />}
      />
      <ProgramsToolbar counts={list.counts} total={list.total} />

      {/* The window gives way to the days on narrower desktops, where the table is made to fit. */}
      {/* Each row is the containing block of its link's overlay, so the overlay covers that row only. */}
      <DataTableRows
        rowLinks
        sortKeys={list.sortKeys}
        defaultSort={list.defaultSort}
        columns={[
          { id: "program", header: t("columns.program") },
          { id: "status", header: t("columns.status") },
          { id: "runs", header: t("columns.runs"), layout: { descFirst: true } },
          { id: "window", header: t("columns.window"), layout: { from: "lg" } },
          {
            id: "open",
            header: <span className="sr-only">{t("columns.open")}</span>,
            layout: { width: "action" },
          },
        ]}
        rows={rows.map((row) => ({
          id: row.program.id,
          cells: {
            program: (
              <div className="flex items-center gap-3">
                <Thumbnail program={row.program} alt="" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  {/* The name is the row's link; it covers the whole row for the pointer. */}
                  <Link
                    href={row.href}
                    className="font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                  >
                    {row.program.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {[row.kind, row.program.partnerName].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
            ),
            status: row.state,
            runs: (
              <span className={row.program.startsOn ? undefined : "text-muted-foreground"}>
                {row.runs}
              </span>
            ),
            window: (
              <span className={row.quietWindow ? "text-muted-foreground" : undefined}>
                {row.window}
              </span>
            ),
            open: <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
          },
        }))}
        empty={empty}
      />

      <p className="text-sm text-muted-foreground">
        {narrowed
          ? t("countOf", { count: rows.length, total: list.total })
          : t("count", { count: list.total })}
      </p>
    </div>
  );
}

export { ProgramsAdminPage };
