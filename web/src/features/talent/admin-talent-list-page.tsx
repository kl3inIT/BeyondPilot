import { SearchXIcon, UsersIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { ListFooter } from "@/components/composites/list-footer";
import { FeaturedBadge } from "@/components/composites/featured-badge";
import { Person } from "@/components/composites/person";
import { ReviewStatus, reviewState } from "@/components/composites/review-status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { useFormatter } from "@/i18n/format";
import { useVocabulary } from "@/i18n/vocabulary";
import type { AdminTalentList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { adminTalentSearch, adminTalentSortKeys, type AdminTalentSearch } from "./talent-search";
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
  const word = useVocabulary("talentStatus");

  const rows = talent.items.map((profile) => ({
    id: profile.id,
    href: `${siteRoutes.adminTalent}/${profile.id}`,
    name: profile.name,
    person: <Person name={profile.name} email={profile.email} />,
    headline: profile.headline ?? "",
    status: (
      <span className="flex flex-col items-start gap-0.5">
        <ReviewStatus state={reviewState(profile)}>{word(reviewState(profile))}</ReviewStatus>
        {profile.featuredAt && <FeaturedBadge>{t("feature.featured")}</FeaturedBadge>}
      </span>
    ),
    // A record that waits says for how long; a decided one keeps the day it was sent.
    submitted: !profile.submittedAt
      ? ""
      : profile.status === "in_review"
        ? t("waitingSince", { time: format.relativeTime(new Date(profile.submittedAt)) })
        : format.dateTime(new Date(profile.submittedAt), "date"),
    waiting: profile.status === "in_review",
  }));

  const filtered = search.q.trim() !== "" || search.status !== null || search.featured !== null;
  const empty =
    rows.length > 0 ? null : search.q.trim() === "" &&
      search.status === "in_review" &&
      search.featured === null ? (
      <DataTableEmpty icon={<UsersIcon aria-hidden="true" />} title={t("queueEmpty.title")}>
        <Button prominence="secondary" size="sm" href={siteRoutes.admin}>
          {t("queueEmpty.home")}
        </Button>
      </DataTableEmpty>
    ) : filtered ? (
      <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
        <Button prominence="secondary" size="sm" href={siteRoutes.adminTalent}>
          {t("noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty icon={<UsersIcon aria-hidden="true" />} title={t("empty.title")} />
    );
  const open = (row: (typeof rows)[number]) => (
    <TextButton href={row.href} aria-label={t("openNamed", { name: row.name })}>
      {t(row.waiting ? "review.open" : "open")}
    </TextButton>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        destination="talent"
        title={t("title")}
        actions={
          <TextButton href={siteRoutes.adminTalentReported}>{t("reported.link")}</TextButton>
        }
      />
      <TalentToolbar />

      {/* The Headline column gives way first where the table is made to fit. */}
      <DataTableRows
        sortKeys={adminTalentSortKeys}
        columns={[
          { id: "name", header: t("columns.person") },
          { id: "headline", header: t("columns.headline"), layout: { from: "xl" } },
          { id: "status", header: t("columns.status") },
          { id: "submitted", header: t("columns.submitted") },
          { id: "actions", header: <span className="sr-only">{t("columns.actions")}</span> },
        ]}
        rows={rows.map((row) => ({
          id: row.id,
          cells: {
            name: row.person,
            headline: (
              <span className="line-clamp-1 max-w-xs text-muted-foreground">{row.headline}</span>
            ),
            status: row.status,
            submitted: <span className="text-muted-foreground">{row.submitted}</span>,
            actions: <div className="flex justify-end">{open(row)}</div>,
          },
        }))}
        empty={empty}
      />

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
