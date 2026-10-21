import { useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { DataTableRows } from "@/components/composites/data-table-view";
import { ListFooter } from "@/components/composites/list-footer";
import { Person } from "@/components/composites/person";
import { Badge } from "@/components/ui/badge";
import { useFormatter } from "@/i18n/format";
import type { MyOrganization, Organization, OrganizationMembers } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { InvitationActions } from "./invitation-actions";
import { InvitePeople } from "./invite-people";
import { JoinAccess } from "./join-access";
import { JoinRequestCard } from "./join-request-card";
import { MemberActions } from "./member-actions";
import { MemberRole } from "./member-role";
import { OrganizationFrame } from "./organization-frame";
import { isApproved } from "./organization-format";
import {
  defaultMemberSort,
  organizationMemberSortKeys,
  organizationMembersSearch,
} from "./organization-members-search";
import { OrganizationSection } from "./organization-section";
import { tablePageSizes } from "@/lib/page-size";

const address = createSerializer(organizationMembersSearch);

type OrganizationMembersPageProps = {
  mine: MyOrganization & { organization: Organization };
  members: OrganizationMembers;
  /** How many solutions the organization has, when it is a provider. */
  solutions: number | null;
  /** How many use cases it has, when it is an enterprise that is not taken down. */
  useCases: number | null;
  /** The page size the URL holds; none is the list's own. */
  size: number | null;
  /** The order the URL holds; none is the list's own. */
  sort: string;
};

/**
 * My organization › Members: who asked to join, who belongs and who was invited, and for owners how
 * many more people they may invite and who may join by email domain. Everything an owner decides here, the backend decides again on each
 * request.
 */
function OrganizationMembersPage({
  mine,
  members,
  solutions,
  useCases,
  size,
  sort,
}: OrganizationMembersPageProps) {
  const t = useTranslations("Organization.members");
  const format = useFormatter();
  const { organization } = mine;
  const owner = mine.role === "owner";
  const emailDomain = organization.emailDomain ?? null;
  const day = (at: string) => format.dateTime(new Date(at), "date");

  // The one owner is known only when the page holds every member; past that the backend decides.
  const owners = members.members.filter((member) => member.role === "owner");
  const onlyOwnerId =
    members.total <= members.members.length && owners.length === 1 ? owners[0].accountId : null;
  const people = members.members.map((member) => ({
    key: member.accountId,
    person: (
      <Person
        name={member.name ?? null}
        email={member.email}
        badge={member.self && <Badge variant="outline">{t("you")}</Badge>}
      />
    ),
    role: <MemberRole role={member.role} />,
    jobTitle: member.jobTitle ?? t("none"),
    joined: <span className="text-muted-foreground">{day(member.joinedAt)}</span>,
    actions: (
      <MemberActions member={member} owner={owner} onlyOwner={member.accountId === onlyOwnerId} />
    ),
  }));
  // The open invitations are not paged: they close the list, on its last page.
  const lastPage = members.page * members.pageSize >= members.total;
  const invited = (lastPage ? members.invitations : []).map((invitation) => ({
    key: invitation.id,
    person: (
      <Person
        name={invitation.email}
        email={t("invited", {
          day: day(invitation.createdAt),
          expires: day(invitation.expiresAt),
        })}
      />
    ),
    role: <MemberRole role={invitation.role} />,
    jobTitle: t("none"),
    joined: <Badge variant="outline">{t("invitePending")}</Badge>,
    actions: owner && <InvitationActions invitation={invitation} />,
  }));
  const rows = [...people, ...invited];

  const allowance = owner ? (members.allowance ?? null) : null;
  const summary = [
    t("summary.members", { count: members.total }),
    members.invitations.length > 0 &&
      t("summary.invitations", { count: members.invitations.length }),
    allowance &&
      (allowance.open
        ? t("summary.left", { left: allowance.leftToday, limit: allowance.dailyLimit })
        : t("summary.takenDown")),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <OrganizationFrame
      mine={mine}
      current="members"
      counts={{ members: members.total, solutions, useCases }}
    >
      {owner && members.requests.length > 0 && (
        <OrganizationSection
          id="members-requests"
          title={t("requests.title")}
          summary={String(members.requests.length)}
        >
          {members.requests.map((request) => (
            <JoinRequestCard
              key={request.id}
              request={request}
              asked={day(request.createdAt)}
              onDomain={
                emailDomain && request.email.toLowerCase().endsWith(`@${emailDomain}`)
                  ? emailDomain
                  : null
              }
            />
          ))}
        </OrganizationSection>
      )}

      <OrganizationSection
        id="members-list"
        title={t("title")}
        summary={summary}
        action={
          allowance?.open && (
            <InvitePeople organizationName={organization.name} allowance={allowance} />
          )
        }
      >
        <DataTableRows
          sortKeys={organizationMemberSortKeys}
          defaultSort={defaultMemberSort}
          surface
          columns={[
            { id: "member", header: t("columns.member") },
            { id: "role", header: t("columns.role"), layout: { width: "sm" } },
            { id: "jobTitle", header: t("columns.jobTitle"), layout: { width: "lg" } },
            { id: "joined", header: t("columns.joined"), layout: { width: "sm", descFirst: true } },
            {
              id: "actions",
              header: <span className="sr-only">{t("columns.actions")}</span>,
              layout: { width: "action" },
            },
          ]}
          rows={rows.map((row) => ({
            id: row.key,
            cells: {
              member: row.person,
              role: row.role,
              jobTitle: <span className="block min-w-40 whitespace-normal">{row.jobTitle}</span>,
              joined: row.joined,
              actions: <div className="flex justify-end">{row.actions}</div>,
            },
          }))}
        />

        {/* Keep the chosen size available even when all members now fit on one page. */}
        {(size !== null || members.total > Math.min(tablePageSizes[0], members.pageSize)) && (
          <ListFooter
            count={t("summary.members", { count: members.total })}
            page={members.page}
            pageSize={members.pageSize}
            total={members.total}
            href={(page) => address(siteRoutes.workspaceMembers, { page, size, sort })}
          />
        )}
      </OrganizationSection>

      {owner && isApproved(organization) && (
        <OrganizationSection id="members-access" title={t("access.title")}>
          <JoinAccess emailDomain={emailDomain} autoJoin={organization.autoJoin} />
        </OrganizationSection>
      )}
    </OrganizationFrame>
  );
}

export { OrganizationMembersPage };
