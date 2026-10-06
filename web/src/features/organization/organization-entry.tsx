import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { MyOrganization } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { OrganizationAction } from "./organization-action";
import { OrganizationFinder } from "./organization-finder";
import { OrganizationInvitation } from "./organization-invitation";
import { OrganizationMark } from "./organization-mark";

/** Where a person who was declined looks for another organization: the same page, on its finder. */
const findHref = `${siteRoutes.workspaceOrganization}?find=1`;

type AnswerProps = {
  title: string;
  /** The organization the request is about. */
  organization: { name: string; type: string; country?: string | null };
  /** When the request was sent or decided, in words. */
  when: string;
  /** What the person can do about it, at the end of the card. */
  action: React.ReactNode;
  /** A second way on, under the way back. */
  more?: React.ReactNode;
  note: string;
};

/** Where a request to get into an organization stands: the organization, what can be done, and why. */
function Answer({ title, organization, when, action, more, note }: AnswerProps) {
  const t = useTranslations("Organization.entry");
  const typeName = useVocabulary("organizationType");
  const countryName = useCountryName();

  return (
    <div className="flex w-full max-w-130 flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-title">{title}</h1>
      <div className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <OrganizationMark name={organization.name} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{organization.name}</span>
            <span className="text-xs text-muted-foreground">
              {[
                typeName(organization.type),
                organization.country && countryName(organization.country),
                when,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-4">
        <Button prominence="secondary" className="w-full" href={siteRoutes.home}>
          {t("back")}
        </Button>
        {more}
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

type OrganizationEntryProps = {
  mine: MyOrganization;
  /** Whether the person chose to look for another organization after a refusal. */
  finding: boolean;
};

/**
 * My organization, for a person who belongs to none yet. One thing at a time: the request they made
 * and can withdraw, then an invitation sent to their address, then the refusal of their last request,
 * and otherwise the ways in: join the one their email domain points at, find one by name, or create
 * it.
 */
function OrganizationEntry({ mine, finding }: OrganizationEntryProps) {
  const t = useTranslations("Organization.entry");
  const format = useFormatter();
  const { request, declined } = mine;
  const invitation = mine.invitations.at(0);
  const day = (at: string) => format.dateTime(new Date(at), { dateStyle: "medium" });

  if (request) {
    const kind = request.claim ? "claim" : "join";
    const name = request.organizationName;
    return (
      <Answer
        title={t(`request.${kind}Title`, { name })}
        organization={{
          name,
          type: request.organizationType,
          country: request.organizationCountry,
        }}
        when={t(`request.${kind}Sent`, { day: day(request.createdAt) })}
        action={
          <OrganizationAction action="withdrawRequest" size="lg">
            {t("request.withdraw")}
          </OrganizationAction>
        }
        note={
          request.claim
            ? t("request.claimNote")
            : request.organizationDomain
              ? t("request.joinNoteDomain", { domain: request.organizationDomain })
              : t("request.joinNote")
        }
      />
    );
  }

  if (invitation) {
    return <OrganizationInvitation key={invitation.id} invitation={invitation} />;
  }

  if (declined && !finding) {
    const kind = declined.claim ? "claim" : "join";
    const name = declined.organizationName;
    return (
      <Answer
        title={t(`declined.${kind}Title`, { name })}
        organization={{
          name,
          type: declined.organizationType,
          country: declined.organizationCountry,
        }}
        when={t("declined.on", { day: day(declined.decidedAt) })}
        action={
          <OrganizationAction action="askAgain" id={declined.organizationId} size="lg">
            {t(`declined.${kind}Again`)}
          </OrganizationAction>
        }
        more={
          <Button prominence="tertiary" className="w-full" href={findHref}>
            {t("declined.findAnother")}
          </Button>
        }
        note={t(`declined.${kind}Note`, { name })}
      />
    );
  }

  return <OrganizationFinder suggestion={mine.suggestion ?? null} />;
}

export { OrganizationEntry };
