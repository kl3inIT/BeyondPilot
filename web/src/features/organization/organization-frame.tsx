import {
  ArrowUpRightIcon,
  Building2Icon,
  GlobeIcon,
  MapPinIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { ReviewStatus } from "@/components/composites/review-status";
import { useFormatter } from "@/i18n/format";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { MyOrganization, Organization } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { NoticeCard } from "./notice-card";
import { OrganizationAction } from "./organization-action";
import { isIndividual } from "./organization-codes";
import { websiteHost } from "./organization-format";
import { OrganizationMark } from "./organization-mark";
import { missingProfileFacts } from "./organization-schemas";
import { OrganizationTabs } from "./organization-tabs";

type OrganizationTab = "profile" | "members" | "solutions" | "useCases";

type OrganizationFrameProps = {
  /** The caller's membership; the frame is drawn only for a person who belongs to an organization. */
  mine: MyOrganization & { organization: Organization };
  current: OrganizationTab;
  /**
   * How many members the organization has, how many solutions when it is a provider and how many
   * use cases when it is an approved enterprise.
   */
  counts: { members: number; solutions: number | null; useCases: number | null };
  children: React.ReactNode;
};

/**
 * What every page of My organization shares: the organization's name and what it is, where its
 * review stands, and the tabs. The tabs follow the organization's role: only a provider has
 * solutions, only an approved enterprise has use cases.
 */
function OrganizationFrame({ mine, current, counts, children }: OrganizationFrameProps) {
  const t = useTranslations("Organization");
  const typeName = useVocabulary("organizationType");
  const reasonName = useVocabulary("organizationRefusal");
  const takeDownReasonName = useVocabulary("organizationTakeDown");
  const countryName = useCountryName();
  const format = useFormatter();
  const { organization, mergedFrom } = mine;
  const owner = mine.role === "owner";
  // A person on their own is shown their solutions only: nothing about them is reviewed, and they
  // have no profile or members of an organization.
  const individual = isIndividual(organization);

  const tabs: { key: OrganizationTab; href: string; label: string; count?: number }[] = [
    ...(individual
      ? []
      : [
          {
            key: "profile" as const,
            href: siteRoutes.workspaceOrganization,
            label: t("tabs.profile"),
          },
          {
            key: "members" as const,
            href: siteRoutes.workspaceMembers,
            label: t("tabs.members"),
            count: counts.members,
          },
        ]),
    ...(counts.solutions === null
      ? []
      : [
          {
            key: "solutions" as const,
            href: siteRoutes.workspaceSolutions,
            label: t("tabs.solutions"),
            count: counts.solutions,
          },
        ]),
    ...(counts.useCases === null
      ? []
      : [
          {
            key: "useCases" as const,
            href: siteRoutes.workspaceUseCases,
            label: t("tabs.useCases"),
            count: counts.useCases,
          },
        ]),
  ];
  const host = websiteHost(organization.website);
  const country = organization.country && countryName(organization.country);
  // The way to the profile is offered from the other tabs, to the people who can change it.
  const toProfile = owner && current !== "profile" && !individual;
  // What the form would still ask of this organization: the reviewer reads the profile without it.
  const missing = missingProfileFacts(organization);

  return (
    <div className="flex flex-1 flex-col bg-muted pt-10 pb-16 md:pt-14 md:pb-24">
      <div className="mx-auto flex w-full max-w-360 flex-col gap-6 px-5 md:px-8 xl:px-16 desktop:px-20">
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <OrganizationMark name={organization.name} logoFileId={organization.logoFileId} />
            <h1 className="min-w-0 text-3xl leading-none font-semibold tracking-title break-words md:text-5xl md:leading-none">
              {organization.name}
            </h1>
          </div>
          <ul aria-label={t("facts")} className="flex gap-x-3 md:flex-wrap md:gap-2">
            <Fact icon={Building2Icon}>{typeName(organization.type)}</Fact>
            {country && <Fact icon={MapPinIcon}>{country}</Fact>}
            {host && organization.website ? (
              <Fact icon={GlobeIcon}>
                <TextButton
                  href={organization.website}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 shrink"
                >
                  <span className="truncate">{host}</span>
                  <ArrowUpRightIcon aria-hidden="true" />
                </TextButton>
              </Fact>
            ) : (
              organization.emailDomain && (
                <Fact icon={GlobeIcon}>
                  <span className="truncate">{organization.emailDomain}</span>
                </Fact>
              )
            )}
          </ul>
        </div>

        {organization.status === "in_review" && !individual && (
          <NoticeCard
            titleAs="h2"
            title={t("inReview.title")}
            description={
              <>
                <p>{t("inReview.lead", { name: organization.name })}</p>
                <p>
                  {missing.length > 0
                    ? t("inReview.missing", {
                        count: missing.length,
                        facts: format.list(missing.map((fact) => t(`form.${fact}`))),
                      })
                    : t("inReview.complete")}
                </p>
              </>
            }
            badge={
              <ReviewStatus state="in_review" appearance="pill">
                {t("status.in_review")}
              </ReviewStatus>
            }
            foot={t("inReview.foot")}
            actions={
              // On the Profile tab the action is the profile's own, under the notice.
              toProfile &&
              (missing.length > 0 ? (
                <Button href={siteRoutes.workspaceOrganization}>{t("form.complete")}</Button>
              ) : (
                <Button prominence="secondary" href={siteRoutes.workspaceOrganization}>
                  {t("inReview.edit")}
                </Button>
              ))
            }
          />
        )}
        {organization.status === "needs_changes" && (
          <NoticeCard
            titleAs="h2"
            title={t("needsChanges.title", { name: organization.name })}
            description={
              organization.decisionMessage && (
                <p className="whitespace-pre-line">{organization.decisionMessage}</p>
              )
            }
            badge={
              <ReviewStatus state="needs_changes" appearance="pill">
                {t("status.needs_changes")}
              </ReviewStatus>
            }
            foot={t(owner ? "needsChanges.owner" : "needsChanges.member")}
            actions={
              toProfile && (
                <Button prominence="secondary" href={siteRoutes.workspaceOrganization}>
                  {t("needsChanges.edit")}
                </Button>
              )
            }
          />
        )}
        {organization.status === "rejected" && (
          <NoticeCard
            titleAs="h2"
            title={t("rejected.title", { name: organization.name })}
            description={
              <>
                <p>
                  {t("rejected.reason", {
                    reason: reasonName(organization.decisionReason ?? "other"),
                  })}
                </p>
                {organization.decisionMessage && (
                  <p className="whitespace-pre-line">{organization.decisionMessage}</p>
                )}
              </>
            }
            badge={
              <ReviewStatus state="rejected" appearance="pill">
                {t("status.rejected")}
              </ReviewStatus>
            }
            foot={t("rejected.foot")}
          />
        )}

        {organization.suspendedAt && organization.suspensionReason && (
          <NoticeCard
            titleAs="h2"
            title={t("suspended.title", { name: organization.name })}
            description={
              <>
                <p>
                  {t("suspended.reason", {
                    reason: takeDownReasonName(organization.suspensionReason),
                  })}
                </p>
                {organization.suspensionMessage && (
                  <p className="whitespace-pre-line">{organization.suspensionMessage}</p>
                )}
              </>
            }
            badge={
              <ReviewStatus state="suspended" appearance="pill">
                {t("status.suspended")}
              </ReviewStatus>
            }
            foot={t("suspended.foot")}
          />
        )}

        {mergedFrom && (
          <NoticeCard
            titleAs="h2"
            title={t("merged.title", { name: mergedFrom.name, kept: organization.name })}
            description={<p>{t("merged.lead", { kept: organization.name })}</p>}
            badge={
              <ReviewStatus state="merged" appearance="pill">
                {t("merged.badge")}
              </ReviewStatus>
            }
            foot={t("merged.foot", { slug: mergedFrom.slug })}
            actions={
              <OrganizationAction action="dismissMergeNotice" prominence="secondary">
                {t("merged.dismiss")}
              </OrganizationAction>
            }
          />
        )}

        {tabs.length > 1 && (
          <OrganizationTabs label={t("tabs.label")} tabs={tabs} current={current} />
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * One thing the organization is, under its name: its kind, its country, its website. A chip from
 * 768px; on a phone plain text on one line, where the last one gives way when they do not fit.
 */
function Fact({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 shrink-0 items-center gap-1.5 text-sm font-medium last:shrink md:h-8 md:rounded-full md:border md:bg-card md:px-3">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      {children}
    </li>
  );
}

export { OrganizationFrame };
