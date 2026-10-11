"use client";

import { StarIcon, StarOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { useNotify } from "@/hooks/use-notify";
import { featureTalent, unfeatureTalent, type TalentSummary } from "@/lib/api/generated";

import { talentError } from "./talent-errors";

type TalentFeatureProps = {
  profile: Pick<TalentSummary, "id" | "name" | "featuredAt">;
};

/**
 * Features a talent profile, or stops featuring it. Nobody is emailed and nothing else about the
 * profile changes, so it asks for no confirmation: the other press undoes it.
 */
function TalentFeature({ profile }: TalentFeatureProps) {
  const t = useTranslations("Admin.talent.feature");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const featured = Boolean(profile.featuredAt);

  async function toggle() {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await (featured ? unfeatureTalent : featureTalent)({ path: { id: profile.id } });
      notify.success(featured ? "Talent.done.unfeatured" : "Talent.done.featured", {
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
      {featured ? <StarOffIcon aria-hidden="true" /> : <StarIcon aria-hidden="true" />}
      {t(featured ? "unfeature" : "feature")}
    </Button>
  );
}

export { TalentFeature };
