import { MailIcon, SearchXIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { CountingNumber } from "@/components/composites/counting-number";
import { DataTableEmpty, DataTablePager } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { StatCell, StatStrip } from "@/components/composites/stat-cell";
import { getFormatter } from "@/i18n/format-server";
import { Link } from "@/i18n/navigation";
import type { EmailMessageList } from "@/lib/api/generated";
import { adminEmailMessageRoute, siteRoutes } from "@/lib/site";

import { EmailActivityToolbar } from "./email-activity-toolbar";
import { EmailHeader } from "./email-header";
import { isEmailKind, KindIcon } from "./email-kinds";
import { emailActivitySearch, type EmailActivitySearch } from "./email-search";
import { EmailStatusLabel } from "./email-status";
import { PageSizeSelect } from "@/components/composites/page-size-select";

/** How many entries a page of the log holds until the reader chooses. */
const LOG_PAGE_SIZE = 50;

const address = createSerializer(emailActivitySearch);

/**
 * Admin › Email › Activity: every email BeyondPilot sent or tried to, newest first, with the counts
 * of the period above the list. A row opens the email as it was sent and what happened to it.
 */
async function EmailActivityPage({
  messages,
  search,
  ready,
}: {
  messages: EmailMessageList;
  search: EmailActivitySearch;
  ready: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations("Admin.email"), getFormatter()]);
  const kindName = (kind: string) => (isEmailKind(kind) ? t(`kinds.${kind}.name`) : kind);
  const time = (at: string) =>
    format.dateTime(new Date(at), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

  const counts = [
    { key: "total", value: messages.counts.total },
    { key: "delivered", value: messages.counts.delivered },
    { key: "sent", value: messages.counts.sent },
    { key: "bounced", value: messages.counts.bounced },
    { key: "complained", value: messages.counts.complained },
    { key: "notSent", value: messages.counts.notSent },
  ] as const;

  const pageHref = (cursor: { before: string } | { after: string }) =>
    address(siteRoutes.adminEmailActivity, { ...search, before: null, after: null, ...cursor });
  const filtered = search.q.trim() !== "" || search.kind !== null || search.status !== null;
  const empty =
    messages.items.length > 0 ? null : filtered ? (
      <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("activity.noMatch.title")}>
        <Button prominence="secondary" size="sm" href={siteRoutes.adminEmailActivity}>
          {t("activity.noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty icon={<MailIcon aria-hidden="true" />} title={t("activity.empty.title")} />
    );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <EmailHeader current="activity" ready={ready} />

      {/* The figures count to their new value when the period changes. */}
      <StatStrip columns={6}>
        {counts.map((count) => (
          <StatCell
            key={count.key}
            label={
              count.key === "total"
                ? t("activity.counts.total", { period: search.period })
                : t(`activity.counts.${count.key}`)
            }
            value={<CountingNumber value={count.value} />}
          />
        ))}
      </StatStrip>

      <EmailActivityToolbar />

      {/* The whole row opens the email. */}
      {/* Each row is the containing block of its link's overlay, so the overlay covers that row only. */}
      <DataTableRows
        rowLinks
        columns={[
          { id: "time", header: t("activity.columns.time"), layout: { width: "md" } },
          { id: "recipient", header: t("activity.columns.recipient") },
          { id: "email", header: t("activity.columns.email") },
          { id: "status", header: t("activity.columns.status"), layout: { width: "md" } },
        ]}
        rows={messages.items.map((message) => ({
          id: message.id,
          cells: {
            time: (
              <time dateTime={message.createdAt} className="text-muted-foreground">
                {time(message.createdAt)}
              </time>
            ),
            recipient: <span className="block max-w-56 truncate">{message.recipient}</span>,
            email: (
              <Link
                href={adminEmailMessageRoute(message.id)}
                className="flex min-w-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <KindIcon kind={message.kind} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{kindName(message.kind)}</span>
                  <span className="truncate text-xs text-muted-foreground">{message.subject}</span>
                </span>
              </Link>
            ),
            status: <EmailStatusLabel status={message.status} />,
          },
        }))}
        empty={empty}
      />

      <DataTablePager
        previous={messages.newer ? pageHref({ after: messages.newer }) : undefined}
        next={messages.older ? pageHref({ before: messages.older }) : undefined}
        sizer={<PageSizeSelect size={search.size ?? LOG_PAGE_SIZE} />}
        labels={{
          navigation: t("activity.pagination.label"),
          previous: t("activity.pagination.previous"),
          next: t("activity.pagination.next"),
          goToPrevious: t("activity.pagination.goToPrevious"),
          goToNext: t("activity.pagination.goToNext"),
        }}
      />
    </div>
  );
}

export { EmailActivityPage };
