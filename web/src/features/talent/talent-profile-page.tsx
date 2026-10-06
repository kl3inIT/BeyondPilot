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
import { initials } from "@/lib/initials";
import { siteRoutes } from "@/lib/site";

import { TalentContact } from "./talent-contact";

type TalentProfilePageProps = {
  profile: PublicTalent;
  /** Where a visitor signs in to write to the person; absent for someone signed in, who writes here. */
  signInHref?: string;
  /** True when the profile is the caller's own: they edit it instead of writing to it. */
  own: boolean;
};

/** The host of an address, which is what a reader recognises of it: "linkedin.com". */
function hostOf(address: string) {
  return URL.canParse(address) ? new URL(address).host.replace(/^www\./, "") : address;
}

/** One profile of the public directory: who the person is, what they did, and the way to write to them. */
function TalentProfilePage({ profile, signInHref, own }: TalentProfilePageProps) {
  const t = useTranslations("Talent.profile");
  const d = useTranslations("Talent.directory");
  const role = useVocabulary("talentRole");
  const availability = useVocabulary("availability");
  const engagement = useVocabulary("engagement");
  const rateBand = useVocabulary("rateBand");
  const countryName = useCountryName();
  const roles = profile.roles.map(role).join(", ");

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-5 px-5 pt-4 pb-24 md:gap-7 md:px-8 md:pt-6 xl:px-16">
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

      <div className="flex items-start gap-3.5 md:items-center md:gap-5">
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full border bg-muted text-lg md:size-18 md:text-2xl"
        >
          {initials(profile.name, profile.name)}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-title text-balance md:text-4xl md:tracking-normal xl:text-5xl xl:leading-none xl:tracking-title">
            {profile.name}
          </h1>
          <p className="text-muted-foreground md:text-lg">{profile.headline ?? roles}</p>
        </div>
      </div>

      <div className="flex flex-col gap-8 md:flex-row md:items-start xl:gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-7 md:gap-9">
          {profile.bio && (
            <section aria-labelledby="talent-about" className="flex flex-col gap-2">
              <h2 id="talent-about" className="text-xl font-semibold">
                {t("about")}
              </h2>
              <p className="whitespace-pre-line text-muted-foreground">{profile.bio}</p>
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
              <ul className="flex flex-col gap-3">
                {profile.projects.map((project, index) => (
                  <ProjectItem key={`${index}-${project.title}`} project={project} />
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted p-4 text-sm text-muted-foreground">
                {t("projects.empty")}
              </p>
            )}
          </section>

          <section aria-labelledby="talent-fit" className="flex flex-col gap-3">
            <h2 id="talent-fit" className="text-xl font-semibold">
              {t("fit.title")}
            </h2>
            <dl className="grid gap-3 md:grid-cols-2">
              {[
                { key: t("fit.skills"), value: profile.skills.join(", ") },
                {
                  key: t("fit.availability"),
                  value: profile.availability && availability(profile.availability),
                },
                {
                  key: t("fit.engagement"),
                  value: profile.engagement.map(engagement).join(", "),
                },
                { key: t("fit.rate"), value: profile.rateBand && rateBand(profile.rateBand) },
              ].map((fact) => (
                <div key={fact.key} className="flex flex-col gap-0.5 rounded-xl bg-muted p-4">
                  <dt className="text-xs text-muted-foreground">{fact.key}</dt>
                  {fact.value ? (
                    <dd className="text-sm font-medium">{fact.value}</dd>
                  ) : (
                    <dd className="text-sm text-muted-foreground">{t("notListed")}</dd>
                  )}
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="md:w-75 md:shrink-0 xl:w-95">
          <TalentContact
            slug={profile.slug}
            name={profile.name}
            availability={profile.availability && availability(profile.availability)}
            notAvailable={profile.availability === "not_available"}
            waitingSince={profile.waitingEnquirySentAt}
            signInHref={signInHref}
            own={own}
          >
            <dl className="flex flex-col gap-2.5">
              <ContactFact name={t("facts.country")}>
                {profile.country ? countryName(profile.country) : t("notListed")}
              </ContactFact>
              <ContactFact name={t("facts.role")}>{roles || t("notListed")}</ContactFact>
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
      </div>
    </div>
  );
}

/**
 * One project as the person stated it. Nobody else has confirmed it, and the badge says so; the
 * frame's stage and confirmation lines have no data behind them.
 */
function ProjectItem({ project }: { project: TalentProject }) {
  const t = useTranslations("Talent.profile.projects");

  return (
    <li className="flex flex-col items-start gap-2 rounded-xl border bg-background p-4">
      <Badge variant="outline">{t("stated")}</Badge>
      <h3 className="text-sm">{project.title}</h3>
      {project.summary && (
        <p className="text-sm whitespace-pre-line text-muted-foreground">{project.summary}</p>
      )}
      {project.year && <p className="text-xs font-medium text-muted-foreground">{project.year}</p>}
      {project.url && (
        <TextButton href={project.url} target="_blank" rel="noreferrer" className="font-normal">
          {t("open")}
          <ArrowRightIcon aria-hidden="true" />
        </TextButton>
      )}
    </li>
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
