"use client";

import { CableIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AppMark } from "@/features/identity/app-mark";
import { useNotify } from "@/hooks/use-notify";
import { revokePersonsApp, type PersonConnectedApp } from "@/lib/api/generated";

/** Every person's connected apps, the latest used first, each with a way to end it. */
function EveryConnectedApp({ apps }: { apps: PersonConnectedApp[] }) {
  const t = useTranslations("Admin.mcp.apps");

  if (apps.length === 0) {
    return (
      <div className="rounded-lg border bg-background">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CableIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("none")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  return (
    <ul aria-label={t("label")} className="overflow-hidden rounded-lg border bg-background">
      {apps.map((app) => (
        <AppRow key={`${app.accountId}-${app.id}`} app={app} />
      ))}
    </ul>
  );
}

function AppRow({ app }: { app: PersonConnectedApp }) {
  const t = useTranslations("Admin.mcp.apps");
  const format = useFormatter();
  const person = app.personName ?? app.personEmail;
  const facts = [
    app.personName ? app.personEmail : null,
    app.usedAt ? t("used", { time: format.relativeTime(new Date(app.usedAt)) }) : null,
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <AppMark host={app.host} clientId={app.clientId} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium">
            {app.name} · {person}
          </span>
          <Badge variant={app.operator ? "default" : "outline"}>
            {app.operator ? t("operator") : t("user")}
          </Badge>
        </div>
        <span className="truncate text-xs text-muted-foreground">{facts.join(" · ")}</span>
      </div>
      <RevokePersonsApp app={app} person={person} />
    </li>
  );
}

/** Ends a person's connection with an app after asking: it stops at its next call. */
function RevokePersonsApp({ app, person }: { app: PersonConnectedApp; person: string }) {
  const t = useTranslations("Admin.mcp.apps.revoke");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await revokePersonsApp({ path: { accountId: app.accountId, id: app.id } });
      notify.success("Admin.mcp.apps.revoke.done", { name: app.name, person });
      router.refresh();
    } catch {
      notify.error("Admin.mcp.apps.revoke.failed");
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        prominence="tertiary"
        size="sm"
        aria-label={t("label", { name: app.name, person })}
        onClick={() => setOpen(true)}
      >
        {t("open")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title", { name: app.name, person })}
        description={t("lead", { person })}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}

export { EveryConnectedApp };
