import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { PublicTalentSummary } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { TalentAvailability } from "./talent-availability";
import { TalentPhoto } from "./talent-photo";
import { TalentSkills } from "./talent-skills";

/**
 * One person in the directory: who they are and where, what they do in a line, their first skills,
 * the first project they show with how far it went (as they stated it; the profile says so), how
 * many projects they show, and whether they take on work. The whole card leads to the profile
 * through the name's link; the count of further skills sits above it and opens the full list.
 */
function TalentCard({ person }: { person: PublicTalentSummary }) {
  const t = useTranslations("Talent.directory");
  const role = useVocabulary("talentRole");
  const stage = useVocabulary("projectStage");
  const countryName = useCountryName();
  const kind = [
    person.roles.length > 0 && role(person.roles[0]),
    person.city ?? (person.country && countryName(person.country)),
  ]
    .filter(Boolean)
    .join(" · ");
  const lead = person.leadProject;

  return (
    <article className="relative flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-ring has-[h2>a:focus-visible]:border-ring has-[h2>a:focus-visible]:ring-3 has-[h2>a:focus-visible]:ring-ring/50">
      <div className="flex items-center gap-3">
        <TalentPhoto
          name={person.name}
          photoFileId={person.photoFileId}
          size={48}
          className="size-12 text-sm"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="truncate font-medium">
            <Link
              href={`${siteRoutes.talent}/${person.slug}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {person.name}
            </Link>
          </h2>
          {kind && <p className="truncate text-xs font-medium text-muted-foreground">{kind}</p>}
        </div>
      </div>
      {person.headline && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{person.headline}</p>
      )}
      {person.skills.length > 0 && <TalentSkills skills={person.skills} />}
      <div className="mt-auto flex flex-col gap-2 pt-1.5 text-xs font-medium">
        <p className="flex min-w-0 items-center gap-1.5">
          <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">
            {lead
              ? [lead.stage && stage(lead.stage), lead.title].filter(Boolean).join(" · ")
              : t("noProject")}
          </span>
        </p>
        {person.projectCount > 1 && (
          <p className="text-muted-foreground">{t("projects", { count: person.projectCount })}</p>
        )}
        {person.availability && <TalentAvailability availability={person.availability} />}
      </div>
    </article>
  );
}

export { TalentCard };
