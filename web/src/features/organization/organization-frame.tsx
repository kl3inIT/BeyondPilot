import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { MyOrganization, Organization } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { NoticeCard } from "./notice-card";
import { websiteHost } from "./organization-format";
import { OrganizationMark } from "./organization-mark";

type OrganizationTab = "profile" | "members" | "solutions" | "introductions";

type OrganizationFrameProps = {
  /** The caller's membership; the frame is drawn only for a person who belongs to an organization. */
  mine: MyOrganization & { organization: Organization };
  current: OrganizationTab;
  /** How many members the organization has, and how many solutions when it is a provider. */
  counts: { members: number; solutions: number | null };
  children: React.ReactNode;
};

/**
 * What every page of My organization shares: the organization's name and what it is, where its
 * review stands, and the tabs. The tabs follow the organization's role: only a provider has
 * solutions.
 */
function OrganizationFrame({ mine, current, counts, children }: OrganizationFrameProps) {
  const t = useTranslations("Organization");
  const typeName = useVocabulary("organizationType");
  const reasonName = useVocabulary("organizationRefusal");
  const takeDownReasonName = useVocabulary("organizationTakeDown");
  const countryName = useCountryName();
  const { organization } = mine;
  const owner = mine.role === "owner";

  const tabs: { key: OrganizationTab; href: string; label: string; count?: number }[] = [
    { key: "profile", href: siteRoutes.workspaceOrganization, label: t("tabs.profile") },
    {
      key: "members",
      href: siteRoutes.workspaceMembers,
      label: t("tabs.members"),
      count: counts.members,
    },
    ...(counts.solutions === null
      ? []
      : [
          {
            key: "solutions" as const,
            href: siteRoutes.workspaceSolutions,
            label: t("tabs.solutions"),
            count: counts.solutions,
          },
          {
            key: "introductions" as const,
            href: siteRoutes.workspaceIntroductions,
            label: t("tabs.introductions"),
          },
        ]),
  ];
  const kind = [
    typeName(organization.type),
    organization.country && countryName(organization.country),
    websiteHost(organization.website) ?? organization.emailDomain,
  ].filter(Boolean);
  // The way to the profile is offered from the other tabs, to the people who can change it.
  const toProfile = owner && current !== "profile";

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-10 pb-16 md:px-8 md:pt-14 md:pb-24 lg:px-16">
      <div className="flex w-full max-w-220 flex-col gap-6">
        <div className="flex flex-col gap-4">
          <OrganizationMark name={organization.name} logoFileId={organization.logoFileId} />
          <h1 className="text-3xl leading-none font-semibold tracking-title break-words md:text-5xl md:leading-none">
            {organization.name}
          </h1>
          <p className="text-sm text-muted-foreground">{kind.join(" · ")}</p>
        </div>

        {organization.status === "pending" && (
          <NoticeCard
            titleAs="h2"
            title={t("pending.title")}
            description={<p>{t("pending.lead", { name: organization.name })}</p>}
            badge={<Badge variant="info">{t("status.pending")}</Badge>}
            foot={t("pending.foot")}
            actions={
              toProfile && (
                <Button prominence="secondary" href={siteRoutes.workspaceOrganization}>
                  {t("pending.edit")}
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
            badge={<Badge variant="info">{t("status.rejected")}</Badge>}
            foot={t(owner ? "rejected.owner" : "rejected.member")}
            actions={
              toProfile && (
                <Button prominence="secondary" href={siteRoutes.workspaceOrganization}>
                  {t("rejected.edit")}
                </Button>
              )
            }
          />
        )}

        {organization.status === "suspended" && organization.suspensionReason && (
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
            badge={<Badge variant="info">{t("status.suspended")}</Badge>}
            foot={t("suspended.foot")}
          />
        )}

        <nav aria-label={t("tabs.label")} className="flex items-end gap-5 border-b">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.key === current ? "page" : undefined}
              className="group -mb-px flex items-center gap-1.5 border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-xs group-aria-[current=page]:text-primary">{tab.count}</span>
              )}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}

export { OrganizationFrame };
