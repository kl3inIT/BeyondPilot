"use client";

import { PinIcon, PinOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { useNotify } from "@/hooks/use-notify";
import { pinTalent, unpinTalent, type TalentSummary } from "@/lib/api/generated";

import { talentError } from "./talent-errors";

type TalentPinProps = {
  profile: Pick<TalentSummary, "id" | "name" | "pinnedAt">;
};

/**
 * Pins a talent profile to the top of the public directory, or unpins it. Nobody is emailed and
 * nothing else about the profile changes, so it asks for no confirmation: the other press undoes it.
 */
function TalentPin({ profile }: TalentPinProps) {
  const t = useTranslations("Admin.talent.pin");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const pinned = Boolean(profile.pinnedAt);

  async function toggle() {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await (pinned ? unpinTalent : pinTalent)({ path: { id: profile.id } });
      notify.success(pinned ? "Talent.done.unpinned" : "Talent.done.pinned", {
        name: profile.name,
      });
      router.refresh();
    } catch (error) {
      notify.error(talentError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button prominence="secondary" pending={pending} onClick={() => void toggle()}>
      {pinned ? <PinOffIcon aria-hidden="true" /> : <PinIcon aria-hidden="true" />}
      {t(pinned ? "unpin" : "pin")}
    </Button>
  );
}

export { TalentPin };
