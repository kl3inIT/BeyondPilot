import { ArrowUpRightIcon, FolderKanbanIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { PublicTalentSummary } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";
import { cn } from "@/lib/utils";

import { TalentPhoto } from "./talent-photo";
import { TalentSkills } from "./talent-skills";

/**
 * One person in the directory, read top to bottom: who they are and where, what they do in a line,
 * the tools they work with, then the work they show (how many projects, the first by name and how far
 * it went, as they stated it). The rose ring marks the kind, as the home page's directory does. The
 * whole card leads to the profile through the name's link; the footer says so, and the count of
 * further skills sits above the link and opens the full list.
 */
function TalentCard({
  person,
  linked = true,
}: {
  person: PublicTalentSummary;
  /** False for a preview of a profile that has no public page yet: no link, no footer. */
  linked?: boolean;
}) {
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
    <article
      className={cn(
        "relative flex min-w-0 flex-1 rounded-2xl",
        linked &&
          "transition-shadow hover:ring-1 hover:ring-ring has-[h2>a:focus-visible]:ring-3 has-[h2>a:focus-visible]:ring-ring/50",
      )}
    >
      <Card size="lg" className="min-w-0 flex-1">
        <CardContent className="flex-1">
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-center gap-3">
              <TalentPhoto name={person.name} photoFileId={person.photoFileId} size="xl" ringed />
              <div className="flex min-w-0 flex-col gap-0.5">
                <h2 className="truncate font-medium">
                  {linked ? (
                    <Link
                      href={`${siteRoutes.talent}/${person.slug}`}
                      className="outline-none after:absolute after:inset-0 after:rounded-2xl"
                    >
                      {person.name}
                    </Link>
                  ) : (
                    person.name
                  )}
                </h2>
                {kind && (
                  <p className="line-clamp-2 text-xs font-medium text-muted-foreground">{kind}</p>
                )}
              </div>
            </div>
            {person.headline && <p className="line-clamp-2 text-sm">{person.headline}</p>}
            {person.skills.length > 0 && <TalentSkills skills={person.skills} />}
            <div className="mt-auto flex flex-col gap-4">
              <Separator />
              <div className="flex flex-col gap-2">
                {lead ? (
                  <>
                    <p className="flex items-center gap-1.5 text-xs font-medium">
                      <FolderKanbanIcon
                        className="size-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
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
            </div>
          </div>
        </CardContent>
        {linked && (
          <CardFooter aria-hidden="true">
            <p className="ml-auto flex items-center gap-1 font-medium text-primary">
              {t("view")}
              <ArrowUpRightIcon className="size-4" />
            </p>
          </CardFooter>
        )}
      </Card>
    </article>
  );
}

export { TalentCard };
