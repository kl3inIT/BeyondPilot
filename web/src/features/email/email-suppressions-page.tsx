import { MailCheckIcon, SearchXIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { EmailSuppressionList } from "@/lib/api/generated";
import { adminEmailMessageRoute, siteRoutes } from "@/lib/site";

import { EmailHeader } from "./email-header";
import { isEmailKind } from "./email-kinds";
import { emailSuppressionsSearch, type EmailSuppressionsSearch } from "./email-search";
import { AddSuppressionButton, RemoveSuppressionButton } from "./email-suppression-actions";
import { EmailSuppressionsToolbar } from "./email-suppressions-toolbar";

const address = createSerializer(emailSuppressionsSearch);

/**
 * Admin › Email › Suppressions: the addresses BeyondPilot no longer writes to, because mail to them
 * bounced, their reader marked it as spam, or an operator stopped it. Removing an address lets
 * email reach it again.
 */
async function EmailSuppressionsPage({
  suppressions,
  search,
  ready,
}: {
  suppressions: EmailSuppressionList;
  search: EmailSuppressionsSearch;
  ready: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations("Admin.email"), getFormatter()]);
  const date = (at: string) =>
    format.dateTime(new Date(at), { day: "numeric", month: "short", year: "numeric" });
  const filtered = search.q.trim() !== "" || search.reason !== null;

  const empty =
    suppressions.items.length > 0 ? null : filtered ? (
      <DataTableEmpty
        icon={<SearchXIcon aria-hidden="true" />}
        title={t("suppressions.noMatch.title")}
        description={t("suppressions.noMatch.description")}
      >
        <Button prominence="secondary" size="sm" href={siteRoutes.adminEmailSuppressions}>
          {t("suppressions.noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty
        icon={<MailCheckIcon aria-hidden="true" />}
        title={t("suppressions.empty.title")}
        description={t("suppressions.empty.description")}
      />
    );

  /** Where the address was stopped: the email that bounced, or the operator who added it. */
  function origin(item: EmailSuppressionList["items"][number]) {
    if (item.messageId) {
      return (
        <Link
          href={adminEmailMessageRoute(item.messageId)}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {item.messageKind && isEmailKind(item.messageKind)
            ? t(`kinds.${item.messageKind}.name`)
            : t("suppressions.theEmail")}
        </Link>
      );
    }
    return item.createdBy ? t("suppressions.addedBy", { name: item.createdBy }) : "—";
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <EmailHeader current="suppressions" ready={ready} action={<AddSuppressionButton />} />

      <EmailSuppressionsToolbar />

      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("suppressions.columns.address")}</TableHead>
            <TableHead className="w-36">{t("suppressions.columns.reason")}</TableHead>
            <TableHead>{t("suppressions.columns.origin")}</TableHead>
            <TableHead className="w-32">{t("suppressions.columns.since")}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t("suppressions.columns.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppressions.items.map((item) => (
            <TableRow key={item.address}>
              <TableCell>
                <span className="font-medium">{item.address}</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{t(`suppressions.reasons.${item.reason}`)}</Badge>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">{origin(item)}</span>
              </TableCell>
              <TableCell>
                <time dateTime={item.createdAt} className="text-muted-foreground">
                  {date(item.createdAt)}
                </time>
              </TableCell>
              <TableCell>
                <RemoveSuppressionButton address={item.address} reason={item.reason} />
              </TableCell>
            </TableRow>
          ))}
          {empty && (
            <TableRow>
              <TableCell colSpan={5}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>

      <ul className="overflow-hidden rounded-lg border md:hidden">
        {suppressions.items.map((item) => (
          <li key={item.address} className="flex items-start gap-3 border-b p-3 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm font-medium">{item.address}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{t(`suppressions.reasons.${item.reason}`)}</Badge>
                <time dateTime={item.createdAt}>{date(item.createdAt)}</time>
              </span>
              <span className="text-xs text-muted-foreground">{origin(item)}</span>
            </div>
            <RemoveSuppressionButton address={item.address} reason={item.reason} />
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      {suppressions.total > 0 && (
        <ListFooter
          count={t("suppressions.count", { count: suppressions.total })}
          page={suppressions.page}
          pageSize={suppressions.pageSize}
          total={suppressions.total}
          href={(page) => address(siteRoutes.adminEmailSuppressions, { ...search, page })}
        />
      )}
    </div>
  );
}

export { EmailSuppressionsPage };
