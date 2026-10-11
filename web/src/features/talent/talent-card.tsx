import { ArrowUpRightIcon, FolderKanbanIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { PublicTalentSummary } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { TalentPhoto } from "./talent-photo";
import { TalentSkills } from "./talent-skills";

/**
 * One person in the directory, read top to bottom: who they are and where, what they do in a line,
 * the tools they work with, then the work they show (how many projects, the first by name and how far
 * it went, as they stated it). The rose ring marks the kind, as the home page's directory does. The
 * whole card leads to the profile through the name's link; the footer says so, and the count of
 * further skills sits above the link and opens the full list.
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
    <article className="relative flex min-w-0 flex-1 flex-col gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-ring has-[h2>a:focus-visible]:border-ring has-[h2>a:focus-visible]:ring-3 has-[h2>a:focus-visible]:ring-ring/50">
      <div className="flex items-center gap-3">
        <TalentPhoto
          name={person.name}
          photoFileId={person.photoFileId}
          size={48}
          className="size-12 text-sm ring-2 ring-talent/40 ring-offset-2 ring-offset-card"
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
          {kind && <p className="line-clamp-2 text-xs font-medium text-muted-foreground">{kind}</p>}
        </div>
      </div>
      {person.headline && <p className="line-clamp-2 text-sm">{person.headline}</p>}
      {person.skills.length > 0 && <TalentSkills skills={person.skills} />}
      <div className="mt-auto flex flex-col gap-2 border-t pt-4">
        {lead ? (
          <>
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <FolderKanbanIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {t("projects", { count: person.projectCount })}
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="max-w-full">
                <span className="truncate">{lead.title}</span>
              </Badge>
              {lead.stage && <Badge variant="secondary">{stage(lead.stage)}</Badge>}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t("noProject")}</p>
        )}
      </div>
      <p
        aria-hidden="true"
        className="-mx-5 -mb-5 flex items-center justify-end gap-1 border-t px-5 py-3 text-sm font-medium text-primary"
      >
        {t("view")}
        <ArrowUpRightIcon className="size-4" />
      </p>
    </article>
  );
}

export { TalentCard };
