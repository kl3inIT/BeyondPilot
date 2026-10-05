import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import type { MyOrganization } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { OrganizationAction } from "./organization-action";
import { OrganizationFinder } from "./organization-finder";
import { OrganizationInvitation } from "./organization-invitation";
import { OrganizationMark } from "./organization-mark";

/**
 * My organization, for a person who belongs to none yet. One thing at a time: the request they made
 * and can withdraw, then an invitation sent to their address, and otherwise the ways in: join the
 * one their email domain points at, find one by name, or create it.
 */
function OrganizationEntry({ mine }: { mine: MyOrganization }) {
  const t = useTranslations("Organization.entry");
  const format = useFormatter();
  const { request } = mine;
  const invitation = mine.invitations.at(0);

  if (request) {
    const sent = format.dateTime(new Date(request.createdAt), { dateStyle: "medium" });
    return (
      <div className="flex w-full max-w-130 flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-title">
          {t(request.claim ? "request.claimTitle" : "request.joinTitle", {
            name: request.organizationName,
          })}
        </h1>
        <div className="flex items-center gap-4 rounded-xl border p-4">
          <OrganizationMark name={request.organizationName} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{request.organizationName}</span>
            <span className="text-xs text-muted-foreground">
              {t(request.claim ? "request.claimSent" : "request.joinSent", { day: sent })}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Button prominence="secondary" className="w-full" href={siteRoutes.home}>
            {t("back")}
          </Button>
          <OrganizationAction action="withdrawRequest" prominence="tertiary" className="w-full">
            {t("request.withdraw")}
          </OrganizationAction>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(request.claim ? "request.claimNote" : "request.joinNote")}
        </p>
      </div>
    );
  }

  if (invitation) {
    return <OrganizationInvitation key={invitation.id} invitation={invitation} />;
  }

  return <OrganizationFinder suggestion={mine.suggestion ?? null} />;
}

export { OrganizationEntry };
