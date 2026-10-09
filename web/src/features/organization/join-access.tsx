"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { useNotify } from "@/hooks/use-notify";
import { changeOrganizationAutoJoin } from "@/lib/api/generated";

import { NoticeCard } from "./notice-card";
import { organizationError } from "./organization-errors";

type JoinAccessProps = {
  /** The email domain GenAI Fund verified, which vouches for colleagues; null when it verified none. */
  emailDomain: string | null;
  /** Whether an address on that domain joins at once, or has to ask. */
  autoJoin: boolean;
};

/**
 * Who can join by email domain, as an owner sets it with one switch: at once as a member, or by
 * asking first. Without a verified domain there is nothing to set, and the card says so.
 */
function JoinAccess({ emailDomain, autoJoin }: JoinAccessProps) {
  const t = useTranslations("Organization.members.access");
  const notify = useNotify();
  const router = useRouter();
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const state = autoJoin ? "on" : "off";

  async function toggle() {
    setPending(true);
    try {
      await changeOrganizationAutoJoin({ body: { autoJoin: !autoJoin } });
      notify.success(autoJoin ? "Organization.done.autoJoinOff" : "Organization.done.autoJoinOn");
      router.refresh();
    } catch (error) {
      notify.error(organizationError(error));
    } finally {
      setPending(false);
    }
  }

  if (!emailDomain) {
    return (
      <NoticeCard
        titleAs="h3"
        title={t("none.title")}
        description={<p>{t("none.lead")}</p>}
        foot={t("none.foot")}
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 id={titleId} className="text-base font-semibold break-words">
          {t(`${state}.title`, { domain: emailDomain })}
        </h3>
        <p className="text-sm text-muted-foreground">{t(`${state}.lead`)}</p>
        <p className="text-xs text-muted-foreground">{t("domain", { domain: emailDomain })}</p>
      </div>
      <Switch
        aria-label={t("toggle")}
        aria-describedby={titleId}
        checked={autoJoin}
        disabled={pending}
        onCheckedChange={toggle}
      />
    </div>
  );
}

export { JoinAccess };
