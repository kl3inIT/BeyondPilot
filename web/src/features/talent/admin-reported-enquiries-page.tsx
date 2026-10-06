import { ArrowLeftIcon, InboxIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import type { AdminTalentEnquiryList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

/**
 * Admin › Talent › Reported messages: what the people behind talent profiles reported as unwanted,
 * the most recently reported first, with who sent each message and to whom. Operators read them;
 * the sender was told the message was declined.
 */
function AdminReportedEnquiriesPage({ enquiries }: { enquiries: AdminTalentEnquiryList }) {
  const t = useTranslations("Admin.talent.reported");
  const format = useFormatter();
  const locale = useLocale();
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <TextButton href={siteRoutes.adminTalent} className="self-start">
        <ArrowLeftIcon aria-hidden="true" />
        {t("back")}
      </TextButton>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("lead")}</p>
      </div>
      {enquiries.items.length === 0 ? (
        <div className="rounded-lg border bg-background">
          <DataTableEmpty
            icon={<InboxIcon aria-hidden="true" />}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        </div>
      ) : (
        <ul className="max-w-3xl overflow-hidden rounded-lg border bg-background">
          {enquiries.items.map((enquiry) => (
            <li key={enquiry.id} className="flex flex-col gap-2 p-4 not-last:border-b">
              <div className="grid gap-0.5 text-sm">
                <span className="font-medium">
                  {t("from", {
                    sender: enquiry.senderName
                      ? `${enquiry.senderName} (${enquiry.senderEmail})`
                      : enquiry.senderEmail,
                  })}
                </span>
                <span className="text-muted-foreground">
                  {t("to", { name: enquiry.profileName })} · {t(`topic.${enquiry.topic}`)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-line">{enquiry.message}</p>
              <p className="text-sm text-muted-foreground">
                {t("sent", { date: date(enquiry.createdAt) })}
                {enquiry.reportedAt && ` · ${t("reportedAt", { date: date(enquiry.reportedAt) })}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <ListFooter
        count={t("count", { count: enquiries.total })}
        page={enquiries.page}
        pageSize={enquiries.pageSize}
        total={enquiries.total}
        href={(page) => `${siteRoutes.adminTalentReported}?page=${page}`}
      />
    </div>
  );
}

export { AdminReportedEnquiriesPage };
