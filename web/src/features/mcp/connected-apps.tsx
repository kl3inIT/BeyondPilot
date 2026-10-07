"use client";

import { CableIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppMark } from "@/features/identity/app-mark";
import { useNotify } from "@/hooks/use-notify";
import { revokeConnectedApp, type ConnectedApp } from "@/lib/api/generated";

type McpTabsProps = {
  connect: React.ReactNode;
  apps: ConnectedApp[];
};

/**
 * The two tabs of the MCP page: how to connect an app, and the apps connected. The empty list leads
 * back to the first.
 */
function McpTabs({ connect, apps }: McpTabsProps) {
  const t = useTranslations("Mcp");
  const [tab, setTab] = useState<string>("connect");

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
      <TabsList variant="underline" aria-label={t("tabs.label")}>
        <TabsTrigger value="connect">{t("tabs.connect")}</TabsTrigger>
        <TabsTrigger value="apps">
          {t("tabs.apps")}
          {apps.length > 0 && (
            <span className="text-xs font-medium in-data-active:text-primary">{apps.length}</span>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="connect">
        <div className="mt-6">{connect}</div>
      </TabsContent>
      <TabsContent value="apps">
        <div className="mt-6">
          {apps.length === 0 ? (
            <div className="rounded-2xl border bg-card">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CableIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("apps.none")}</EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                  <Button prominence="secondary" size="sm" onClick={() => setTab("connect")}>
                    {t("apps.connect")}
                  </Button>
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-2xl border bg-card">
              {apps.map((app) => (
                <AppRow key={app.id} app={app} />
              ))}
            </ul>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function AppRow({ app }: { app: ConnectedApp }) {
  const t = useTranslations("Mcp.apps");
  const format = useFormatter();
  const facts = [
    app.allowedAt &&
      t("allowed", { date: format.dateTime(new Date(app.allowedAt), { dateStyle: "medium" }) }),
    app.usedAt && t("used", { time: format.relativeTime(new Date(app.usedAt)) }),
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0 md:px-5">
      <AppMark host={app.host} clientId={app.clientId} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{app.name}</span>
        <span className="text-xs text-muted-foreground">{facts.join(" · ")}</span>
      </div>
      <RevokeApp app={app} />
    </li>
  );
}

/** Ends the app's connection after asking: it stops at its next call. */
function RevokeApp({ app }: { app: ConnectedApp }) {
  const t = useTranslations("Mcp.revoke");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await revokeConnectedApp({ path: { id: app.id } });
      notify.success("Mcp.revoke.done", { name: app.name });
      router.refresh();
    } catch {
      notify.error("Mcp.revoke.failed");
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button prominence="tertiary" size="sm" onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title", { name: app.name })}
        description={t("lead")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}

export { McpTabs };
