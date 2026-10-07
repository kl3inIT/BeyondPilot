import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { PublicTalent, TalentProject } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { TalentContact } from "./talent-contact";
import { TalentPhoto } from "./talent-photo";

type TalentProfilePageProps = {
  profile: PublicTalent;
  /** Where a visitor signs in to write to the person; absent for someone signed in, who writes here. */
  signInHref?: string;
  /** True when the profile is the caller's own: they edit it instead of writing to it. */
  own: boolean;
  /** The signed-in caller's name, to sign a message with; empty when the account has none. */
  senderName?: string;
};

/** The host of an address, which is what a reader recognises of it: "linkedin.com". */
function hostOf(address: string) {
  return URL.canParse(address) ? new URL(address).host.replace(/^www\./, "") : address;
}

/**
 * One profile of the public directory, as the Figma frame draws it: who the person is, the counts
 * that sum up their work, the projects as a timeline with how far each went, their skills and
 * industries, and beside it the one way to write to them with the work they take on. On a phone
 * that card comes first, under the head.
 */
function TalentProfilePage({ profile, signInHref, own, senderName }: TalentProfilePageProps) {
  const t = useTranslations("Talent.profile");
  const d = useTranslations("Talent.directory");
  const role = useVocabulary("talentRole");
  const engagement = useVocabulary("engagement");
  const language = useVocabulary("language");
  const industry = useVocabulary("industry");
  const countryName = useCountryName();
  const place = [profile.city, profile.country && countryName(profile.country)]
    .filter(Boolean)
    .join(", ");
  const kind = [profile.roles.length > 0 && role(profile.roles[0]), place]
    .filter(Boolean)
    .join(" · ");
  const staged = (stage: TalentProject["stage"]) =>
    profile.projects.filter((project) => project.stage === stage).length;
  // A count of none is left out; the row shows only when there is a project to count.
  const stats = (
    [
      ["projects", profile.projects.length],
      ["inProduction", staged("in_production")],
      ["pilots", staged("pilot")],
      ["industries", profile.industries.length],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ value: count, label: t(`stats.${key}`, { count }) }));

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-5 pt-4 pb-24 md:gap-8 md:px-8 md:pt-6 xl:px-16 desktop:px-20">
      <Breadcrumb aria-label={t("trail")}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={siteRoutes.talent} />}>{d("title")}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{profile.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <TalentPhoto
          name={profile.name}
          photoFileId={profile.photoFileId}
          size={96}
          alt={t("photoAlt", { name: profile.name })}
          className="size-18 text-xl md:size-24 md:text-2xl"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-title text-balance md:text-4xl xl:text-5xl xl:leading-none">
            {profile.name}
          </h1>
          {kind && <p className="text-muted-foreground">{kind}</p>}
          {profile.headline && (
            <p className="text-muted-foreground md:text-lg">{profile.headline}</p>
          )}
        </div>
      </div>

      {profile.projects.length > 0 && (
        <dl className="grid grid-cols-2 gap-4 border-y py-5 md:flex md:gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">{stat.label}</dt>
              {/* The number reads first; the term still comes first for assistive technology. */}
              <dd className="order-first text-2xl font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-col gap-8 md:flex-row-reverse md:items-start xl:gap-12">
        <div className="md:w-75 md:shrink-0 xl:w-95">
          <TalentContact
            slug={profile.slug}
            name={profile.name}
            waitingSince={profile.waitingEnquirySentAt}
            signInHref={signInHref}
            own={own}
            senderName={senderName}
            intro={
              profile.engagement.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("openTo", { engagement: profile.engagement.map(engagement).join(", ") })}
                </p>
              )
            }
          >
            <dl className="flex flex-col gap-2.5">
              <ContactFact name={t("facts.country")}>{place || t("notListed")}</ContactFact>
              {profile.languages.length > 0 && (
                <ContactFact name={t("facts.languages")}>
                  {profile.languages.map(language).join(", ")}
                </ContactFact>
              )}
              {profile.worksAt && (
                <ContactFact name={t("facts.worksAt")}>
                  {profile.worksAt}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({t("facts.worksAtStated")})
                  </span>
                </ContactFact>
              )}
              {profile.website && (
                <ContactFact name={t("facts.website")}>
                  <TextButton
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium"
                  >
                    {hostOf(profile.website)}
                    <ArrowRightIcon aria-hidden="true" />
                  </TextButton>
                </ContactFact>
              )}
            </dl>
            <p className="text-xs text-muted-foreground">{t("note", { name: profile.name })}</p>
          </TalentContact>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-8 md:gap-10">
          {profile.bio && (
            <section aria-labelledby="talent-about" className="flex flex-col gap-2">
              <h2 id="talent-about" className="text-xl font-semibold">
                {t("about")}
              </h2>
              <p className="max-w-prose whitespace-pre-line text-muted-foreground">{profile.bio}</p>
            </section>
          )}

          <section aria-labelledby="talent-projects" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="talent-projects" className="text-xl font-semibold">
                {t("projects.title")}
              </h2>
              {profile.projects.length > 0 && (
                <p className="text-sm text-muted-foreground">{t("projects.lead")}</p>
              )}
            </div>
            {profile.projects.length > 0 ? (
              <ol className="flex flex-col">
                {profile.projects.map((project, index) => (
                  <ProjectEntry key={`${index}-${project.title}`} project={project} />
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted p-4 text-sm text-muted-foreground">
                {t("projects.empty")}
              </p>
            )}
          </section>

          {(profile.skills.length > 0 || profile.industries.length > 0) && (
            <section aria-labelledby="talent-skills" className="flex flex-col gap-3">
              <h2 id="talent-skills" className="text-xl font-semibold">
                {t("skills.title")}
              </h2>
              <BadgeGroup title={t("skills.skills")} labels={profile.skills} />
              <BadgeGroup
                title={t("skills.industries")}
                labels={profile.industries.map(industry)}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One project on the timeline: the year and how far it went on the left, what it was and the
 * person's part on the right, as the person states them.
 */
function ProjectEntry({ project }: { project: TalentProject }) {
  const t = useTranslations("Talent.profile.projects");
  const stage = useVocabulary("projectStage");

  return (
    <li className="flex flex-col gap-3 border-t py-5 md:flex-row md:gap-6">
      <div className="flex shrink-0 flex-row items-center gap-2 md:w-32 md:flex-col md:items-start">
        {project.year && <span className="text-sm text-muted-foreground">{project.year}</span>}
        {project.stage && <Badge variant="outline">{stage(project.stage)}</Badge>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="font-medium">{project.title}</h3>
        {project.summary && (
          <p className="max-w-180 text-sm whitespace-pre-line text-muted-foreground">
            {project.summary}
          </p>
        )}
        {project.url && (
          <TextButton
            href={project.url}
            target="_blank"
            rel="noreferrer"
            className="self-start font-normal"
          >
            {t("open")}
            <ArrowRightIcon aria-hidden="true" />
          </TextButton>
        )}
      </div>
    </li>
  );
}

function BadgeGroup({ title, labels }: { title: string; labels: string[] }) {
  if (labels.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm text-muted-foreground">{title}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <li key={label}>
            <Badge variant="outline">{label}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactFact({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <dt className="text-xs text-muted-foreground">{name}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export { TalentProfilePage };
