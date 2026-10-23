import { CalendarSyncIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DetailList } from "@/components/composites/detail-list";
import { Status } from "@/components/composites/status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatterOf, momentText } from "@/i18n/formats";
import type { LumaConnection } from "@/lib/api/generated";

import { ConnectLuma, DisconnectLuma } from "./luma-connection-actions";
import { LumaReadButton } from "./luma-read-button";
import { ProgramsAdminTabs } from "./programs-admin-tabs";

/**
 * Admin › Programs › Luma: the Luma calendar whose events become programs by themselves (BEY-245).
 * An operator pastes the calendar's API key once; BeyondPilot checks it, makes its webhook and reads
 * the calendar, then every hour and whenever Luma says an event changed. The key is never shown again.
 */
async function LumaAdminPage({ connection }: { connection: LumaConnection }) {
  const [t, locale] = await Promise.all([getTranslations("Admin.programs.lumaTab"), getLocale()]);
  const format = formatterOf(locale);
  const calendar = connection.calendar;

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        destination="programs"
        title={t("title")}
        actions={
          calendar ? (
            <>
              <LumaReadButton />
              <ConnectLuma replacing disabled={!connection.encryptionReady} />
              <DisconnectLuma calendar={calendar.name} />
            </>
          ) : null
        }
      >
        <ProgramsAdminTabs current="luma" />
      </AdminPageHeader>

      {!connection.encryptionReady && (
        <Alert>
          <AlertTitle>{t("noEncryption.title")}</AlertTitle>
          <AlertDescription>{t("noEncryption.description")}</AlertDescription>
        </Alert>
      )}

      {calendar ? (
        <DetailList
          layout="framed"
          className="max-w-3xl"
          details={[
            {
              key: "calendar",
              label: t("calendar"),
              value: (
                <span className="flex flex-col">
                  <span className="font-medium">{calendar.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{calendar.id}</span>
                </span>
              ),
            },
            {
              key: "key",
              label: t("key"),
              value: (
                <span className="font-mono">
                  {calendar.keyEnding
                    ? t("keyEnding", { ending: calendar.keyEnding })
                    : t("keyHidden")}
                </span>
              ),
            },
            {
              key: "webhook",
              label: t("webhook.label"),
              value: calendar.webhook ? (
                <Status tone="success">{t("webhook.on")}</Status>
              ) : (
                <span className="flex flex-col gap-0.5">
                  <Status tone="warning">{t("webhook.off")}</Status>
                  {calendar.webhookError && (
                    <span className="text-sm text-muted-foreground">{calendar.webhookError}</span>
                  )}
                </span>
              ),
            },
            {
              key: "read",
              label: t("lastRead.label"),
              value: calendar.lastReadError ? (
                <span className="flex flex-col gap-0.5">
                  <Status tone="destructive">{calendar.lastReadError}</Status>
                  {calendar.lastReadAt && (
                    <span className="text-sm text-muted-foreground">
                      {t("lastRead.before", {
                        at: momentText(format, new Date(calendar.lastReadAt)),
                      })}
                    </span>
                  )}
                </span>
              ) : calendar.lastReadAt ? (
                momentText(format, new Date(calendar.lastReadAt))
              ) : (
                t("lastRead.never")
              ),
            },
            {
              key: "connected",
              label: t("connected"),
              value: momentText(format, new Date(calendar.connectedAt)),
            },
          ]}
        />
      ) : (
        <DataTableEmpty
          icon={<CalendarSyncIcon aria-hidden="true" />}
          title={t("empty.title")}
          description={t("empty.description")}
        >
          <ConnectLuma replacing={false} disabled={!connection.encryptionReady} />
        </DataTableEmpty>
      )}
    </div>
  );
}

export { LumaAdminPage };
