import { useTranslations } from "next-intl";

import type { PerkCard } from "@/lib/api/generated";

type PerkAudienceProps = {
  audience: PerkCard["audience"];
  /** The program whose applicants or shortlist may get it. */
  programName?: string | null;
};

/** Who may get a perk, in a few words: everyone, members, or the applicants or shortlist of a program. */
function PerkAudience({ audience, programName }: PerkAudienceProps) {
  const t = useTranslations("Perk.audience");

  return (
    <span className="min-w-0">
      {audience === "applicants" || audience === "shortlisted"
        ? t(audience, { program: programName ?? "" })
        : t(audience)}
    </span>
  );
}

export { PerkAudience };
