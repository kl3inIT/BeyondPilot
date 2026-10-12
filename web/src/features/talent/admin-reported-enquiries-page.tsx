import { InboxIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { useVocabulary } from "@/i18n/vocabulary";
import type { AdminTalentEnquiryList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { reportedEnquiriesSearch } from "./talent-search";

const address = createSerializer(reportedEnquiriesSearch);

/**
 * Admin › Talent › Reported messages: what the people behind talent profiles reported as unwanted,
 * the most recently reported first, with who sent each message and to whom. Operators read them;
 * the sender was told the message was declined.
 */
function AdminReportedEnquiriesPage({
  enquiries,
  size,
}: {
  enquiries: AdminTalentEnquiryList;
  /** The page size the URL holds; none is the list's own. */
  size: number | null;
}) {
  const t = useTranslations("Admin.talent.reported");
  const topic = useVocabulary("enquiryTopic");
  const format = useFormatter();
  const locale = useLocale();
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        back={{ href: siteRoutes.adminTalent, label: t("back") }}
        title={t("title")}
        lead={t("lead")}
      />
      {enquiries.items.length === 0 ? (
        <Card>
          <CardContent>
            <DataTableEmpty icon={<InboxIcon aria-hidden="true" />} title={t("empty.title")} />
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-3xl">
          <ItemGroup>
            {enquiries.items.map((enquiry) => (
              <div key={enquiry.id} role="listitem">
                <Item variant="outline">
                  <ItemContent>
                    <ItemTitle>
                      {t("from", {
                        sender: enquiry.senderName
                          ? `${enquiry.senderName} (${enquiry.senderEmail})`
                          : enquiry.senderEmail,
                      })}
                    </ItemTitle>
                    <p className="text-muted-foreground">
                      {t("to", { name: enquiry.profileName })} · {topic(enquiry.topic)}
                    </p>
                    <p className="whitespace-pre-line">{enquiry.message}</p>
                    <p className="text-muted-foreground">
                      {t("sent", { date: date(enquiry.createdAt) })}
                      {enquiry.reportedAt &&
                        ` · ${t("reportedAt", { date: date(enquiry.reportedAt) })}`}
                    </p>
                  </ItemContent>
                </Item>
              </div>
            ))}
          </ItemGroup>
        </div>
      )}
      <ListFooter
        count={t("count", { count: enquiries.total })}
        page={enquiries.page}
        pageSize={enquiries.pageSize}
        total={enquiries.total}
        href={(page) => address(siteRoutes.adminTalentReported, { page, size })}
      />
    </div>
  );
}

export { AdminReportedEnquiriesPage };
