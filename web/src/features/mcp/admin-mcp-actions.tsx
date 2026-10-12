"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useAppForm } from "@/components/form/app-form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useNotify } from "@/hooks/use-notify";
import {
  addAppHost,
  allowOtherAppHosts,
  removeAppHost,
  switchMcpTool,
  switchMcpUserServer,
} from "@/lib/api/generated";

/** Runs a change, says how it went, and reads the page again. */
function useChange() {
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return {
    pending,
    async run(change: () => Promise<unknown>) {
      setPending(true);
      try {
        await change();
        notify.success("Admin.mcp.saved");
        router.refresh();
      } catch {
        notify.error("Admin.mcp.failed");
      } finally {
        setPending(false);
      }
    },
  };
}

/** A switch with its label beside it, and a line under the label. */
function LabelledSwitch({
  label,
  hint,
  checked,
  pending,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  pending: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} disabled={pending} onCheckedChange={onChange} />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/** Asks before a change that stops what connected apps do, and runs it once confirmed. */
function useAsked(change: ReturnType<typeof useChange>) {
  const [asking, setAsking] = useState(false);
  return {
    asking,
    setAsking,
    async confirm(run: () => Promise<unknown>) {
      await change.run(run);
      setAsking(false);
    },
  };
}

/**
 * The user server's switch: off, it answers 404 and every app connected to it stops, so turning
 * it off is asked again with the number of those apps. Turning it on is not.
 */
function UserServerSwitch({ enabled, apps }: { enabled: boolean; apps: number }) {
  const t = useTranslations("Admin.mcp.setup.user");
  const ask = useTranslations("Admin.mcp.confirm");
  const change = useChange();
  const asked = useAsked(change);
  const off = () => switchMcpUserServer({ body: { enabled: false } });
  return (
    <>
      <LabelledSwitch
        label={enabled ? t("on") : t("off")}
        checked={enabled}
        pending={change.pending}
        onChange={(next) =>
          next
            ? change.run(() => switchMcpUserServer({ body: { enabled: true } }))
            : asked.setAsking(true)
        }
      />
      <ConfirmDialog
        open={asked.asking}
        onOpenChange={asked.setAsking}
        title={ask("userOff.title")}
        description={ask("userOff.lead", { count: apps })}
        note={ask("userOff.note")}
        confirmLabel={ask("turnOff")}
        cancelLabel={ask("cancel")}
        tone="danger"
        pending={change.pending}
        onConfirm={() => void asked.confirm(off)}
      />
    </>
  );
}

/**
 * A tool's switch: off, its server stops listing it and refuses a call to it, so turning it off
 * is asked again with the number of apps connected to that server.
 */
function ToolSwitch({
  server,
  serverName,
  name,
  enabled,
  label,
  apps,
}: {
  server: string;
  serverName: string;
  name: string;
  enabled: boolean;
  label: string;
  apps: number;
}) {
  const ask = useTranslations("Admin.mcp.confirm");
  const change = useChange();
  const asked = useAsked(change);
  const turn = (next: boolean) => () =>
    switchMcpTool({ path: { server, tool: name }, body: { enabled: next } });
  return (
    <>
      <Switch
        aria-label={label}
        checked={enabled}
        disabled={change.pending}
        onCheckedChange={(next) => (next ? change.run(turn(true)) : asked.setAsking(true))}
      />
      <ConfirmDialog
        open={asked.asking}
        onOpenChange={asked.setAsking}
        title={ask("toolOff.title", { tool: name })}
        description={ask("toolOff.lead", { server: serverName, count: apps })}
        confirmLabel={ask("turnOff")}
        cancelLabel={ask("cancel")}
        tone="danger"
        pending={change.pending}
        onConfirm={() => void asked.confirm(turn(false))}
      />
    </>
  );
}

/** Whether apps of hosts not reviewed may connect, labelled Not reviewed. */
function OtherHostsSwitch({ allowed }: { allowed: boolean }) {
  const t = useTranslations("Admin.mcp.setup.hosts");
  const change = useChange();
  return (
    <LabelledSwitch
      label={t("others")}
      hint={t("othersHint")}
      checked={allowed}
      pending={change.pending}
      onChange={(next) => change.run(() => allowOtherAppHosts({ body: { allowed: next } }))}
    />
  );
}

/**
 * Takes a host off the reviewed list, after asking: its apps then connect labelled Not reviewed,
 * or not at all when apps of other hosts are not allowed.
 */
function RemoveHost({
  host,
  apps,
  othersAllowed,
}: {
  host: string;
  apps: string[];
  othersAllowed: boolean;
}) {
  const t = useTranslations("Admin.mcp.setup.hosts");
  const ask = useTranslations("Admin.mcp.confirm");
  const change = useChange();
  const asked = useAsked(change);
  return (
    <>
      <IconButton
        size="sm"
        prominence="tertiary"
        aria-label={t("remove", { host })}
        disabled={change.pending}
        onClick={() => asked.setAsking(true)}
      >
        <XIcon />
      </IconButton>
      <ConfirmDialog
        open={asked.asking}
        onOpenChange={asked.setAsking}
        title={ask("hostRemove.title", { host })}
        description={
          othersAllowed ? ask("hostRemove.labelled", { host }) : ask("hostRemove.refused", { host })
        }
        note={apps.length > 0 ? ask("hostRemove.apps", { apps: apps.join(", ") }) : undefined}
        confirmLabel={ask("remove")}
        cancelLabel={ask("cancel")}
        tone="danger"
        pending={change.pending}
        onConfirm={() => void asked.confirm(() => removeAppHost({ body: { host } }))}
      />
    </>
  );
}

/** Adds a host to the reviewed list. The field has no label of its own: the button names it. */
function AddHost() {
  const t = useTranslations("Admin.mcp.setup.hosts");
  const change = useChange();
  const id = useId();
  const form = useAppForm({
    defaultValues: { host: "" },
    onSubmit: async ({ value, formApi }) => {
      const host = value.host.trim();
      if (host) {
        await change.run(async () => {
          await addAppHost({ body: { host } });
          formApi.reset();
        });
      }
    },
  });
  return (
    <form
      id={form.formId}
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex gap-2">
        <form.Field name="host">
          {(field) => (
            <Input
              aria-label={t("add")}
              aria-describedby={`${id}-hint`}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              className="flex-1"
            />
          )}
        </form.Field>
        <Button type="submit" prominence="secondary" pending={change.pending}>
          {t("add")}
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {t("addHint")}
      </p>
    </form>
  );
}

export { AddHost, OtherHostsSwitch, RemoveHost, ToolSwitch, UserServerSwitch };
