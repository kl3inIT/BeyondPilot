import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { CodeList } from "@/components/composites/code-list";
import { Badge } from "@/components/ui/badge";
import { useVocabulary } from "@/i18n/vocabulary";
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
>;

/**
 * A talent profile as the operators read it in review: the bio and the work on the left, the facts
 * on the right. The public page has its own layout (`talent-profile-page.tsx`).
 */
function TalentView({ profile }: { profile: TalentContent }) {
  const t = useTranslations("Talent.view");
  const role = useVocabulary("talentRole");
  const engagement = useVocabulary("engagement");
  const rateBand = useVocabulary("rateBand");
  const language = useVocabulary("language");
  const industry = useVocabulary("industry");
  const stage = useVocabulary("projectStage");

  const facts = [
    { title: t("roles"), labels: profile.roles.map(role) },
    { title: t("skills"), labels: profile.skills },
    { title: t("engagement"), labels: profile.engagement.map(engagement) },
    { title: t("languages"), labels: profile.languages.map(language) },
    { title: t("industries"), labels: profile.industries.map(industry) },
    { title: t("rate"), labels: profile.rateBand ? [rateBand(profile.rateBand)] : [] },
  ].filter((fact) => fact.labels.length > 0);

  return (
    <div className="grid gap-10 lg:grid-cols-3">
      <div className="flex flex-col gap-8 lg:col-span-2">
        {profile.bio ? (
          <p className="max-w-prose whitespace-pre-line">{profile.bio}</p>
        ) : (
          <p className="text-muted-foreground">{t("nothingYet")}</p>
        )}
        {profile.projects.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{t("projects")}</h2>
            <ul className="flex flex-col gap-4">
              {profile.projects.map((project) => (
                <li key={project.title} className="flex flex-col gap-1 border-l-2 pl-4">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h3 className="font-medium">{project.title}</h3>
                    {project.year && (
                      <span className="text-sm text-muted-foreground">{project.year}</span>
                    )}
                    {project.stage && <Badge variant="outline">{stage(project.stage)}</Badge>}
                  </div>
                  {project.summary && (
                    <p className="max-w-prose text-sm whitespace-pre-line text-muted-foreground">
                      {project.summary}
                    </p>
                  )}
                  {project.url && (
                    <TextButton
                      href={project.url}
                      target="_blank"
                      rel="noreferrer"
                      size="sm"
                      className="self-start"
                    >
                      {t("openProject")}
                      <ExternalLinkIcon aria-hidden="true" />
                    </TextButton>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <aside className="flex flex-col gap-6">
        {facts.map((fact) => (
          <div key={fact.title} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{fact.title}</h2>
            <CodeList labels={fact.labels} />
          </div>
        ))}
        {profile.website && (
          <TextButton
            href={profile.website}
            target="_blank"
            rel="noreferrer"
            className="self-start"
          >
            {t("website")}
            <ExternalLinkIcon aria-hidden="true" />
          </TextButton>
        )}
      </aside>
    </div>
  );
}

export { TalentView };
