import { HandshakeIcon, SearchXIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import { Status } from "@/components/composites/status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AdminIntroduction, AdminIntroductionList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import {
  adminIntroductionsSearch,
  type AdminIntroductionsSearch,
} from "./admin-introductions-search";
import { AdminIntroductionsToolbar } from "./admin-introductions-toolbar";

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
      <AdminPageHeader destination="introductions" title={t("title")} lead={t("lead")} />
      <AdminIntroductionsToolbar />

      {introductions.overdue > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {t("overdueNotice", { count: introductions.overdue })}
          </AlertDescription>
        </Alert>
      )}

      {introductions.items.length > 0 ? (
        <ul className="overflow-hidden rounded-lg border">
          {introductions.items.map((introduction) => (
            <AdminIntroductionCard key={introduction.id} introduction={introduction} />
          ))}
        </ul>
      ) : filtered ? (
        <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
          <Button prominence="secondary" size="sm" href={siteRoutes.adminIntroductions}>
            {t("noMatch.clear")}
          </Button>
        </DataTableEmpty>
      ) : (
        <DataTableEmpty icon={<HandshakeIcon aria-hidden="true" />} title={t("empty.title")} />
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
