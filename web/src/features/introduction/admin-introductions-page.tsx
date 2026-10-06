import { HandshakeIcon, SearchXIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import { Status } from "@/components/composites/status";
import { AdminPageTitle } from "@/components/layout/admin-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import type { AdminIntroduction, AdminIntroductionList } from "@/lib/api/generated";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

import {
  adminIntroductionsSearch,
  introductionStatuses,
  type AdminIntroductionsSearch,
} from "./admin-introductions-search";

const address = createSerializer(adminIntroductionsSearch);

const tones = { pending: "warning", replied: "success", declined: "neutral" } as const;

type AdminIntroductionsPageProps = {
  introductions: AdminIntroductionList;
  search: AdminIntroductionsSearch;
};

/** One request as an operator reads it: who asked whom, about what, in which words, and for how long. */
function AdminIntroductionCard({ introduction }: { introduction: AdminIntroduction }) {
  const t = useTranslations("Admin.introductions");
  const format = useFormatter();
  const sender = introduction.senderName
    ? t("sender", { name: introduction.senderName, organization: introduction.senderOrganization })
    : t("senderUnnamed", { organization: introduction.senderOrganization });
  const when = new Date(introduction.createdAt);

  return (
    <li className="flex flex-col gap-2 border-b p-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col text-sm">
          <span className="font-medium">
            {t("route", {
              sender: introduction.senderOrganization,
              provider: introduction.providerOrganization,
            })}
          </span>
          <span className="text-muted-foreground">
            {t("about", { solution: introduction.solutionName })} · {sender}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Status tone={tones[introduction.status]}>{t(`status.${introduction.status}`)}</Status>
          {introduction.overdue && (
            <span className="text-xs font-medium text-destructive">{t("overdue")}</span>
          )}
        </div>
      </div>
      <p className="text-sm whitespace-pre-line">{introduction.message}</p>
      <p className="text-xs text-muted-foreground">
        {introduction.status === "pending"
          ? t("waitingSince", { time: format.relativeTime(when) })
          : t("answered", {
              date: format.dateTime(new Date(introduction.answeredAt ?? introduction.createdAt), {
                dateStyle: "medium",
              }),
            })}
      </p>
    </li>
  );
}

/**
 * Admin › Introductions: the requests for an introduction, those that wait first and the longest
 * wait on top, each with its message in full and no address. Operators read; the owners of the
 * provider answer. A request that waited longer than three days is marked.
 */
function AdminIntroductionsPage({ introductions, search }: AdminIntroductionsPageProps) {
  const t = useTranslations("Admin.introductions");
  const locale = useLocale();
  const filtered = search.q.trim() !== "" || search.status !== null;

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-col gap-1">
        <AdminPageTitle destination="introductions">{t("title")}</AdminPageTitle>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>

      {introductions.overdue > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {t("overdueNotice", { count: introductions.overdue })}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <form
          action={siteRoutes.adminIntroductions}
          method="get"
          role="search"
          className="flex gap-2"
        >
          {search.status && <input type="hidden" name="status" value={search.status} />}
          <Input
            type="search"
            name="q"
            defaultValue={search.q}
            maxLength={100}
            aria-label={t("search")}
            placeholder={t("search")}
            className="w-64"
          />
          <Button type="submit" prominence="secondary">
            {t("searchButton")}
          </Button>
        </form>
        <nav aria-label={t("filter.label")} className="flex flex-wrap gap-1.5 text-sm">
          {[null, ...introductionStatuses].map((status) => (
            <Link
              key={status ?? "all"}
              href={address(siteRoutes.adminIntroductions, { q: search.q, status, page: 1 })}
              aria-current={search.status === status ? "page" : undefined}
              className="rounded-md border px-2.5 py-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              {t(status ? `status.${status}` : "filter.all")}
            </Link>
          ))}
        </nav>
      </div>

      {introductions.items.length > 0 ? (
        <ul className="overflow-hidden rounded-lg border">
          {introductions.items.map((introduction) => (
            <AdminIntroductionCard key={introduction.id} introduction={introduction} />
          ))}
        </ul>
      ) : filtered ? (
        <DataTableEmpty
          icon={<SearchXIcon aria-hidden="true" />}
          title={t("noMatch.title")}
          description={t("noMatch.description")}
        >
          <Button prominence="secondary" size="sm" href={siteRoutes.adminIntroductions}>
            {t("noMatch.clear")}
          </Button>
        </DataTableEmpty>
      ) : (
        <DataTableEmpty
          icon={<HandshakeIcon aria-hidden="true" />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      )}

      <ListFooter
        count={t("count", { count: introductions.total })}
        page={introductions.page}
        pageSize={introductions.pageSize}
        total={introductions.total}
        href={(page) => address(siteRoutes.adminIntroductions, { ...search, page })}
      />
    </div>
  );
}

export { AdminIntroductionsPage };
