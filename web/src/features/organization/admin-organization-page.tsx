import { ArrowLeftIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { DataTable } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import { Person } from "@/components/composites/person";
import { ReviewStatus, reviewState } from "@/components/composites/review-status";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { AdminOrganization } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { AdminInvite } from "./admin-invite";
import { AdminInvitationActions, AdminMemberActions } from "./admin-member-actions";
import {
  adminOrganizationSearch,
  adminOrganizationTabs,
  type AdminOrganizationTab,
} from "./admin-organization-search";
import { ClaimDecisionButton } from "./claim-decision";
import { MemberRole } from "./member-role";
import { NoticeCard } from "./notice-card";
import { OrganizationForm } from "./organization-form";
import { OrganizationReviewButton } from "./organization-review";
import { RestoreButton, TakeDownMenu } from "./organization-take-down";

/** How many members a page of the Members tab holds. */
const MEMBERS_PAGE_SIZE = 10;

const address = createSerializer(adminOrganizationSearch);

type AdminOrganizationPageProps = {
  detail: AdminOrganization;
  tab: AdminOrganizationTab;
  /** The page of members, counted from 1. */
  page: number;
};

/**
 * Admin › Organisations › one organization: its profile and verified domain, which an operator
 * changes as its owners do, and its people. An operator also decides what waits (the review of a new
 * organization, a claim on one nobody owns) and takes an approved organization down or restores it.
 */
function AdminOrganizationPage({ detail, tab, page }: AdminOrganizationPageProps) {
  const t = useTranslations("Admin.organizations.detail");
  const s = useTranslations("Organization.status");
  const typeName = useVocabulary("organizationType");
  const reasonName = useVocabulary("organizationRefusal");
  const takeDownReasonName = useVocabulary("organizationTakeDown");
  const countryName = useCountryName();
  const format = useFormatter();
  const locale = useLocale();
  const { organization } = detail;
  const record = `${siteRoutes.adminOrganizations}/${organization.id}`;
  const day = (at: string) => format.dateTime(new Date(at), { dateStyle: "medium" });
  const state = reviewState(organization);
  const suspended = state === "suspended";

  const tabs = adminOrganizationTabs.map((key) => ({
    key,
    label: t(`tabs.${key}`),
    count: key === "members" ? detail.members.length : undefined,
  }));
  const kind = [
    typeName(organization.type),
    organization.country && countryName(organization.country),
    t("createdByOn", { name: detail.createdBy, day: day(organization.createdAt) }),
  ].filter(Boolean);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div>
        <TextButton href={siteRoutes.adminOrganizations}>
          <ArrowLeftIcon aria-hidden="true" />
          {t("back")}
        </TextButton>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
          <ReviewStatus state={state}>{s(state)}</ReviewStatus>
          <p className="text-sm text-muted-foreground">{kind.join(" · ")}</p>
        </div>
        <div className="flex items-center gap-2">
          {state === "approved" && (
            <>
              <Button
                prominence="secondary"
                href={`${siteRoutes.organizations}/${organization.slug}`}
              >
                {t("viewPage")}
              </Button>
              <TakeDownMenu organization={organization} members={detail.members.length} />
            </>
          )}
          {state === "in_review" && <OrganizationReviewButton organization={organization} />}
        </div>
      </div>

      {state === "rejected" && (
        <p className="rounded-lg border bg-muted p-3 text-sm">
          <span className="font-medium">
            {t("refused", { reason: reasonName(organization.decisionReason ?? "other") })}
          </span>
          {organization.decisionMessage && <> {organization.decisionMessage}</>}
        </p>
      )}
      {state === "needs_changes" && (
        <p className="rounded-lg border bg-muted p-3 text-sm">
          <span className="font-medium">{t("sentBack")}</span>
          {organization.decisionMessage && <> {organization.decisionMessage}</>}
        </p>
      )}
      {suspended && organization.suspensionReason && organization.suspendedAt && (
        <NoticeCard
          titleAs="h2"
          title={t("takenDown.title", { day: day(organization.suspendedAt) })}
          description={
            <>
              <p>
                {t("takenDown.reason", {
                  reason: takeDownReasonName(organization.suspensionReason),
                })}
              </p>
              {organization.suspensionMessage && (
                <p className="whitespace-pre-line">{organization.suspensionMessage}</p>
              )}
            </>
          }
          badge={<Badge variant="info">{s("suspended")}</Badge>}
          foot={t("takenDown.foot", { members: detail.members.length })}
          actions={
            <RestoreButton
              organization={organization}
              reason={takeDownReasonName(organization.suspensionReason)}
            />
          }
        />
      )}

      {detail.claims.length > 0 && (
        <section aria-labelledby="organization-claims" className="flex flex-col gap-3">
          <h2 id="organization-claims" className="text-sm font-semibold">
            {t("claims")}
          </h2>
          <ul className="overflow-hidden rounded-lg border">
            {detail.claims.map((claim) => (
              <li key={claim.id} className="flex flex-col gap-3 border-b p-3 last:border-b-0">
                <Person name={claim.name ?? null} email={claim.email} />
                {claim.message && <p className="text-sm text-muted-foreground">{claim.message}</p>}
                <div>
                  <ClaimDecisionButton organization={organization} claimId={claim.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label={t("tabs.label")} className="flex items-end gap-5 border-b">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={address(record, { tab: item.key })}
            aria-current={item.key === tab ? "page" : undefined}
            className="group -mb-px flex items-center gap-1.5 border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
          >
            {item.label}
            {item.count !== undefined && (
              <span className="text-xs group-aria-[current=page]:text-primary">{item.count}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "profile" ? (
        // The key gives a saved organization a fresh form, so it holds the new version.
        <OrganizationForm key={organization.version} organization={organization} admin />
      ) : (
        <AdminMembers detail={detail} page={page} record={record} />
      )}
    </div>
  );
}

/** The Members tab: who belongs, ten at a time, and who was invited, with what an operator does to each. */
function AdminMembers({
  detail,
  page,
  record,
}: {
  detail: AdminOrganization;
  page: number;
  record: string;
}) {
  const t = useTranslations("Admin.organizations.people");
  const format = useFormatter();
  const { organization, members, invitations } = detail;
  const total = members.length;
  const lastPage = Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), lastPage);
  const owners = members.filter((member) => member.role === "owner").length;
  const day = (at: string) => format.dateTime(new Date(at), { dateStyle: "medium" });

  const people = members
    .slice((current - 1) * MEMBERS_PAGE_SIZE, current * MEMBERS_PAGE_SIZE)
    .map((member) => ({
      key: member.accountId,
      person: <Person name={member.name ?? null} email={member.email} />,
      role: <MemberRole role={member.role} />,
      joined: <span className="text-muted-foreground">{day(member.joinedAt)}</span>,
      actions: (
        <AdminMemberActions
          organizationId={organization.id}
          member={member}
          onlyOwner={member.role === "owner" && owners === 1}
        />
      ),
    }));
  // The open invitations are not paged: they close the list, on its last page.
  const invited = (current === lastPage ? invitations : []).map((invitation) => ({
    key: invitation.id,
    person: (
      <Person name={invitation.email} email={t("invited", { day: day(invitation.createdAt) })} />
    ),
    role: <MemberRole role={invitation.role} />,
    joined: <Badge variant="outline">{t("invitePending")}</Badge>,
    actions: <AdminInvitationActions organizationId={organization.id} invitation={invitation} />,
  }));
  const rows = [...people, ...invited];
  const summary = [
    t("summary.members", { count: total }),
    invitations.length > 0 && t("summary.invitations", { count: invitations.length }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-labelledby="admin-members" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="admin-members" className="text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <AdminInvite organization={organization} />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          {/* From 768px: a table. */}
          <DataTable className="hidden bg-background md:block">
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.member")}</TableHead>
                <TableHead className="w-30">{t("columns.role")}</TableHead>
                <TableHead className="w-32">{t("columns.joined")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("columns.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.person}</TableCell>
                  <TableCell>{row.role}</TableCell>
                  <TableCell>{row.joined}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">{row.actions}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>

          {/* Below 768px: one stacked row per person, never a table scrolled sideways. */}
          <ul className="overflow-hidden rounded-lg border bg-background md:hidden">
            {rows.map((row) => (
              <li key={row.key} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  {row.person}
                  {row.actions}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-11 text-sm">
                  {row.role}
                  {row.joined}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <ListFooter
        count={t("summary.members", { count: total })}
        page={current}
        pageSize={MEMBERS_PAGE_SIZE}
        total={total}
        href={(next) => address(record, { tab: "members", page: next })}
      />
    </section>
  );
}

export { AdminOrganizationPage };
