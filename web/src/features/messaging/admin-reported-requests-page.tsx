import { InboxIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { ListFooter } from "@/components/composites/list-footer";
import { Person } from "@/components/composites/person";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { useFormatter } from "@/i18n/format";
import type { ReportedRequestList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { reportedRequestsSearch } from "./messaging-search";

const address = createSerializer(reportedRequestsSearch);

/**
 * Admin › Reported messages: the first messages the side written to reported as unwanted, the most
 * recently reported first, with who sent each and about what. Operators read these and no other
 * conversation; the sender was told only that the message was declined.
 */
function AdminReportedRequestsPage({
  requests,
  size,
}: {
  requests: ReportedRequestList;
  /** The page size the URL holds; none is the list's own. */
  size: number | null;
}) {
  const t = useTranslations("Messaging");
  const format = useFormatter();
  const locale = useLocale();

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        destination="reportedMessages"
        title={t("reported.title")}
        lead={t("reported.lead")}
      />

      <DataTableRows
        columns={[
          { id: "sender", header: t("reported.columns.sender"), layout: { top: true } },
          { id: "about", header: t("reported.columns.about"), layout: { top: true } },
          { id: "message", header: t("reported.columns.message"), layout: { fill: true } },
          {
            id: "reported",
            header: t("reported.columns.reported"),
            layout: { top: true, nowrap: true },
          },
        ]}
        rows={requests.items.map((request) => ({
          id: request.id,
          cells: {
            sender: (
              <div className="flex flex-col gap-1">
                <Person
                  name={request.senderName ?? null}
                  email={request.senderEmail || t("reported.noAccount")}
                />
                <span className="text-sm text-muted-foreground">
                  {request.senderOrganization ?? t("reported.noOrganization")}
                </span>
              </div>
            ),
            about: (
              <div className="flex flex-col text-sm">
                <span className="font-medium">{request.subjectName}</span>
                <span className="text-muted-foreground">{t(`kind.${request.kind}`)}</span>
              </div>
            ),
            message: <p className="text-sm break-words whitespace-pre-line">{request.message}</p>,
            reported: (
              <span className="text-muted-foreground">
                {format.dateTime(new Date(request.reportedAt ?? request.createdAt), "date")}
              </span>
            ),
          },
        }))}
        empty={
          requests.items.length === 0 ? (
            <DataTableEmpty
              icon={<InboxIcon aria-hidden="true" />}
              title={t("reported.empty.title")}
              description={t("reported.empty.lead")}
            />
          ) : null
        }
      />

      <ListFooter
        count={t("reported.count", { count: requests.total })}
        page={requests.page}
        pageSize={requests.pageSize}
        total={requests.total}
        href={(page) => address(siteRoutes.adminMessagesReported, { page, size })}
      />
    </div>
  );
}

export { AdminReportedRequestsPage };
