"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
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

/** The user server's switch: off, it answers 404 and every app connected to it stops. */
function UserServerSwitch({ enabled }: { enabled: boolean }) {
  const t = useTranslations("Admin.mcp.setup.user");
  const change = useChange();
  return (
    <LabelledSwitch
      label={enabled ? t("on") : t("off")}
      checked={enabled}
      pending={change.pending}
      onChange={(next) => change.run(() => switchMcpUserServer({ body: { enabled: next } }))}
    />
  );
}

/** A tool's switch: off, its server stops listing it and refuses a call to it. */
function ToolSwitch({
  server,
  name,
  enabled,
  label,
}: {
  server: string;
  name: string;
  enabled: boolean;
  label: string;
}) {
  const change = useChange();
  return (
    <Switch
      aria-label={label}
      checked={enabled}
      disabled={change.pending}
      onCheckedChange={(next) =>
        change.run(() => switchMcpTool({ path: { server, tool: name }, body: { enabled: next } }))
      }
    />
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

/** Takes a host off the reviewed list. */
function RemoveHost({ host }: { host: string }) {
  const t = useTranslations("Admin.mcp.setup.hosts");
  const change = useChange();
  return (
    <IconButton
      size="sm"
      prominence="tertiary"
      aria-label={t("remove", { host })}
      disabled={change.pending}
      onClick={() => change.run(() => removeAppHost({ body: { host } }))}
    >
      <XIcon />
    </IconButton>
  );
}

/** Adds a host to the reviewed list. */
function AddHost() {
  const t = useTranslations("Admin.mcp.setup.hosts");
  const change = useChange();
  const [host, setHost] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (host.trim()) {
          void change.run(async () => {
            await addAppHost({ body: { host: host.trim() } });
            setHost("");
          });
        }
      }}
    >
      <Input
        aria-label={t("add")}
        placeholder="app.example.com"
        value={host}
        onChange={(event) => setHost(event.target.value)}
        className="flex-1"
      />
      <Button type="submit" prominence="secondary" pending={change.pending}>
        {t("add")}
      </Button>
    </form>
  );
}

export { AddHost, OtherHostsSwitch, RemoveHost, ToolSwitch, UserServerSwitch };
