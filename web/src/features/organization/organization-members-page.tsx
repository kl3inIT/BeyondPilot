import { useFormatter, useTranslations } from "next-intl";

import { DataTable } from "@/components/composites/data-table";
import { Person } from "@/components/composites/person";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useVocabulary } from "@/i18n/vocabulary";
import type { MyOrganization, Organization, OrganizationMembers } from "@/lib/api/generated";

import { InvitationActions } from "./invitation-actions";
import { InvitePeople } from "./invite-people";
import { JoinAccess } from "./join-access";
import { MemberActions } from "./member-actions";
import { NoticeCard } from "./notice-card";
import { OrganizationAction } from "./organization-action";
import { OrganizationFrame } from "./organization-frame";
import { OrganizationSection } from "./organization-section";

type OrganizationMembersPageProps = {
  mine: MyOrganization & { organization: Organization };
  members: OrganizationMembers;
  /** How many solutions the organization has, when it is a provider. */
  solutions: number | null;
  /** How many use cases it has, when it is an approved enterprise. */
  useCases: number | null;
};

/**
 * My organization › Members: who asked to join, who belongs and who was invited, and for owners who
 * may join by email domain. Everything an owner decides here, the backend decides again on each
 * request.
 */
function OrganizationMembersPage({
  mine,
  members,
  solutions,
  useCases,
}: OrganizationMembersPageProps) {
  const t = useTranslations("Organization.members");
  const roleName = useVocabulary("memberRole");
  const format = useFormatter();
  const { organization } = mine;
  const owner = mine.role === "owner";
  const emailDomain = organization.emailDomain ?? null;
  const day = (at: string) => format.dateTime(new Date(at), { dateStyle: "medium" });

  const people = members.members.map((member) => ({
    key: member.accountId,
    person: (
      <Person
        name={member.name ?? null}
        email={member.email}
        badge={member.self && <Badge variant="outline">{t("you")}</Badge>}
      />
    ),
    role:
      member.role === "owner" ? (
        <Badge variant="outline">{roleName("owner")}</Badge>
      ) : (
        <span className="text-muted-foreground">{roleName("member")}</span>
      ),
    jobTitle: member.jobTitle ?? t("none"),
    joined: <span className="text-muted-foreground">{day(member.joinedAt)}</span>,
    actions: <MemberActions member={member} owner={owner} />,
  }));
  const invited = members.invitations.map((invitation) => ({
    key: invitation.id,
    person: (
      <Person name={invitation.email} email={t("invited", { day: day(invitation.createdAt) })} />
    ),
    role: <span className="text-muted-foreground">{roleName(invitation.role)}</span>,
    jobTitle: t("none"),
    joined: <Badge variant="outline">{t("invitePending")}</Badge>,
    actions: owner && <InvitationActions invitation={invitation} />,
  }));
  const rows = [...people, ...invited];

  const summary = [
    t("summary.members", { count: members.members.length }),
    members.invitations.length > 0 &&
      t("summary.invitations", { count: members.invitations.length }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <OrganizationFrame
      mine={mine}
      current="members"
      counts={{ members: members.members.length, solutions, useCases }}
    >
      {owner && members.requests.length > 0 && (
        <OrganizationSection
          id="members-requests"
          title={t("requests.title")}
          summary={String(members.requests.length)}
        >
          {members.requests.map((request) => (
            <NoticeCard
              key={request.id}
              titleAs="h3"
              title={request.name ?? request.email}
              description={
                <>
                  <p>
                    {request.name && <>{request.email} · </>}
                    {t("requests.asked", { day: day(request.createdAt) })}
                    {emailDomain && request.email.toLowerCase().endsWith(`@${emailDomain}`) && (
                      <> {t("requests.onDomain", { domain: emailDomain })}</>
                    )}
                  </p>
                  {request.message && <p className="whitespace-pre-line">{request.message}</p>}
                </>
              }
              foot={t("requests.foot")}
              actions={
                <>
                  <OrganizationAction
                    action="approveRequest"
                    id={request.id}
                    prominence="secondary"
                  >
                    {t("requests.approve")}
                  </OrganizationAction>
                  <OrganizationAction action="declineRequest" id={request.id} prominence="tertiary">
                    {t("requests.decline")}
                  </OrganizationAction>
                </>
              }
            />
          ))}
        </OrganizationSection>
      )}

      <OrganizationSection
        id="members-list"
        title={t("title")}
        summary={summary}
        action={owner && <InvitePeople organizationName={organization.name} />}
      >
        {/* From 768px: a table. */}
        <DataTable className="hidden bg-background md:block">
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.member")}</TableHead>
              <TableHead className="w-30">{t("columns.role")}</TableHead>
              <TableHead className="w-50">{t("columns.jobTitle")}</TableHead>
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
                <TableCell className="whitespace-normal">{row.jobTitle}</TableCell>
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
                {row.jobTitle !== t("none") && <span>{row.jobTitle}</span>}
                {row.joined}
              </div>
            </li>
          ))}
        </ul>
      </OrganizationSection>

      {owner && emailDomain && (
        <OrganizationSection id="members-access" title={t("access.title")}>
          <JoinAccess emailDomain={emailDomain} autoJoin={organization.autoJoin} />
        </OrganizationSection>
      )}
    </OrganizationFrame>
  );
}

export { OrganizationMembersPage };
