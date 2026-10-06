import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { Badge } from "@/components/ui/badge";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { TalentProfile } from "@/lib/api/generated";

/** What a profile says about its person, as operators review it. */
type TalentContent = Pick<
  TalentProfile,
  | "bio"
  | "roles"
  | "skills"
  | "engagement"
  | "rateBand"
  | "website"
  | "projects"
  | "languages"
  | "industries"
  | "city"
  | "country"
  | "worksAt"
>;

/**
 * A talent profile as the operators read it in review, in one column: the bio, the deployed
 * projects each with how far it went, then the facts. The public page has its own layout
 * (`talent-profile-page.tsx`).
 */
function TalentView({ profile }: { profile: TalentContent }) {
  const t = useTranslations("Talent.view");
  const role = useVocabulary("talentRole");
  const engagement = useVocabulary("engagement");
  const rateBand = useVocabulary("rateBand");
  const language = useVocabulary("language");
  const industry = useVocabulary("industry");
  const stage = useVocabulary("projectStage");
  const countryName = useCountryName();
  const place = [profile.city, profile.country && countryName(profile.country)]
    .filter(Boolean)
    .join(", ");

  const facts = [
    { title: t("roles"), value: profile.roles.map(role).join(", ") },
    { title: t("skills"), value: profile.skills.join(", ") },
    { title: t("industries"), value: profile.industries.map(industry).join(", ") },
    { title: t("languages"), value: profile.languages.map(language).join(", ") },
    { title: t("place"), value: place },
    { title: t("worksAt"), value: profile.worksAt ?? "" },
    { title: t("engagement"), value: profile.engagement.map(engagement).join(", ") },
    { title: t("rate"), value: profile.rateBand ? rateBand(profile.rateBand) : "" },
  ].filter((fact) => fact.value !== "");

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="talent-about" className="flex flex-col gap-3">
        <h2 id="talent-about" className="text-xl font-semibold">
          {t("about")}
        </h2>
        {profile.bio ? (
          <p className="whitespace-pre-line text-muted-foreground">{profile.bio}</p>
        ) : (
          <p className="text-muted-foreground">{t("nothingYet")}</p>
        )}
      </section>

      <section aria-labelledby="talent-projects" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="talent-projects" className="text-xl font-semibold">
            {t("projects")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {profile.projects.length > 0 ? t("projectsLead") : t("noProject")}
          </p>
        </div>
        {profile.projects.length > 0 && (
          <ul className="flex flex-col gap-3">
            {profile.projects.map((project) => (
              <li
                key={project.title}
                className="flex flex-col items-start gap-2 rounded-xl border bg-card p-4"
              >
                {(project.stage || project.year) && (
                  <div className="flex items-center gap-2">
                    {project.stage && <Badge variant="outline">{stage(project.stage)}</Badge>}
                    {project.year && (
                      <span className="text-sm text-muted-foreground">{project.year}</span>
                    )}
                  </div>
                )}
                <h3 className="font-medium">{project.title}</h3>
                {project.summary && (
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {project.summary}
                  </p>
                )}
                {project.url && (
                  <TextButton href={project.url} target="_blank" rel="noreferrer" size="sm">
                    {t("openProject")}
                    <ArrowRightIcon aria-hidden="true" />
                  </TextButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="talent-facts" className="flex flex-col gap-4">
        <h2 id="talent-facts" className="text-xl font-semibold">
          {t("facts")}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.title} className="flex flex-col gap-1 rounded-xl bg-muted p-4">
              <dt className="text-xs text-muted-foreground">{fact.title}</dt>
              <dd className="text-sm font-medium">{fact.value}</dd>
            </div>
          ))}
          {profile.website && (
            <div className="flex flex-col items-start gap-1 rounded-xl bg-muted p-4">
              <dt className="text-xs text-muted-foreground">{t("website")}</dt>
              <dd className="max-w-full min-w-0">
                <TextButton
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  size="sm"
                  className="max-w-full"
                >
                  <span className="truncate">{profile.website}</span>
                </TextButton>
              </dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}

export { TalentView };
