"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Status } from "@/components/composites/status";
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
 * Who can join by email domain, as an owner sets it: at once as a member, or by asking first. Without
 * a verified domain there is nothing to set, and the card says so.
 */
function JoinAccess({ emailDomain, autoJoin }: JoinAccessProps) {
  const t = useTranslations("Organization.members.access");
  const notify = useNotify();
  const router = useRouter();
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
    <NoticeCard
      titleAs="h3"
      title={t(`${state}.title`, { domain: emailDomain })}
      description={<p>{t(`${state}.lead`)}</p>}
      badge={
        <Status appearance="pill" tone={autoJoin ? "success" : "neutral"}>
          {t(`${state}.badge`)}
        </Status>
      }
      foot={t("domain", { domain: emailDomain })}
      actions={
        <Button prominence="secondary" pending={pending} onClick={toggle}>
          {t(`${state}.action`)}
        </Button>
      }
    />
  );
}

export { JoinAccess };
