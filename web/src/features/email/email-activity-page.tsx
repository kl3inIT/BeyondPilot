import { MailIcon, SearchXIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTable, DataTableEmpty, DataTablePager } from "@/components/composites/data-table";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { EmailMessageList } from "@/lib/api/generated";
import { adminEmailMessageRoute, siteRoutes } from "@/lib/site";

import { EmailActivityToolbar } from "./email-activity-toolbar";
import { EmailHeader } from "./email-header";
import { isEmailKind, KindIcon } from "./email-kinds";
import { emailActivitySearch, type EmailActivitySearch } from "./email-search";
import { EmailStatusLabel } from "./email-status";

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
      <DataTableEmpty
        icon={<SearchXIcon aria-hidden="true" />}
        title={t("activity.noMatch.title")}
        description={t("activity.noMatch.description")}
      >
        <Button prominence="secondary" size="sm" href={siteRoutes.adminEmailActivity}>
          {t("activity.noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty
        icon={<MailIcon aria-hidden="true" />}
        title={t("activity.empty.title")}
        description={t("activity.empty.description")}
      />
    );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <EmailHeader current="activity" ready={ready} />

      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-6">
        {counts.map((count) => (
          <div key={count.key} className="flex flex-col gap-0.5 bg-background px-4 py-3">
            <dt className="text-xs text-muted-foreground">
              {count.key === "total"
                ? t("activity.counts.total", { period: search.period })
                : t(`activity.counts.${count.key}`)}
            </dt>
            <dd className="text-xl font-semibold tabular-nums">{format.number(count.value)}</dd>
          </div>
        ))}
      </dl>

      <EmailActivityToolbar />

      {/* From 768px: a table. The whole row opens the email. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">{t("activity.columns.time")}</TableHead>
            <TableHead>{t("activity.columns.recipient")}</TableHead>
            <TableHead>{t("activity.columns.email")}</TableHead>
            <TableHead className="w-36">{t("activity.columns.status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.items.map((message) => (
            <TableRow key={message.id} className="relative">
              <TableCell>
                <time dateTime={message.createdAt} className="text-muted-foreground">
                  {time(message.createdAt)}
                </time>
              </TableCell>
              <TableCell>
                <span className="block max-w-56 truncate">{message.recipient}</span>
              </TableCell>
              <TableCell>
                <Link
                  href={adminEmailMessageRoute(message.id)}
                  className="flex min-w-0 items-center gap-2 outline-none after:absolute after:inset-0 focus-visible:underline"
                >
                  <KindIcon kind={message.kind} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{kindName(message.kind)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {message.subject}
                    </span>
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <EmailStatusLabel status={message.status} />
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

      {/* Below 768px: one stacked row per email, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {messages.items.map((message) => (
          <li key={message.id} className="border-b last:border-b-0">
            <Link
              href={adminEmailMessageRoute(message.id)}
              className="flex flex-col gap-1 p-3 outline-none focus-visible:bg-muted/50"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium">{message.recipient}</span>
                <EmailStatusLabel status={message.status} />
              </span>
              <span className="truncate text-sm">{kindName(message.kind)}</span>
              <time dateTime={message.createdAt} className="text-xs text-muted-foreground">
                {time(message.createdAt)}
              </time>
            </Link>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      <DataTablePager
        previous={messages.newer ? pageHref({ after: messages.newer }) : undefined}
        next={messages.older ? pageHref({ before: messages.older }) : undefined}
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
