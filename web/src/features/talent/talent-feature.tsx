"use client";

import { StarIcon, StarOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { useNotify } from "@/hooks/use-notify";
import { featureTalent, unfeatureTalent, type TalentSummary } from "@/lib/api/generated";

type TalentFeatureProps = {
  profile: Pick<TalentSummary, "id" | "name" | "featuredAt">;
};

/**
 * Features a talent profile, or stops featuring it. Nobody is emailed and nothing else about the
 * profile changes, so it runs at once and its toast offers Undo (docs/conventions.md › Actions).
 */
function TalentFeature({ profile }: TalentFeatureProps) {
  const t = useTranslations("Admin.talent.feature");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const featured = Boolean(profile.featuredAt);

  /** Features the profile or stops featuring it; what Undo sends offers no Undo of its own. */
  async function feature(next: boolean, undoable: boolean) {
    setPending(true);
    try {
      await (next ? featureTalent : unfeatureTalent)({ path: { id: profile.id } });
      notify.success(
        next ? "Talent.done.featured" : "Talent.done.unfeatured",
        { name: profile.name },
        undoable ? { undo: () => void feature(!next, false) } : undefined,
      );
      router.refresh();
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(false);
    }
  }

  const toggle = () => (pending ? undefined : feature(!featured, true));

  return (
    <Button prominence="secondary" pending={pending} onClick={() => void toggle()}>
      {featured ? <StarOffIcon aria-hidden="true" /> : <StarIcon aria-hidden="true" />}
      {t(featured ? "unfeature" : "feature")}
    </Button>
  );
}

export { TalentFeature };
