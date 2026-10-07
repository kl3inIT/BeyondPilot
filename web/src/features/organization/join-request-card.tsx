import { useTranslations } from "next-intl";

import { Person } from "@/components/composites/person";
import { Status } from "@/components/composites/status";
import type { OrganizationJoinRequest } from "@/lib/api/generated";

import { OrganizationAction } from "./organization-action";

type JoinRequestCardProps = {
  request: OrganizationJoinRequest;
  /** The day the person asked, formatted by the page. */
  asked: string;
  /** The organization's verified domain, when the person's address is on it. */
  onDomain: string | null;
};

/**
 * A request to join, for an owner to decide: who asks and when, their message set apart as theirs,
 * and the two decisions.
 */
function JoinRequestCard({ request, asked, onDomain }: JoinRequestCardProps) {
  const t = useTranslations("Organization.members.requests");
  const second = [request.name && request.email, t("asked", { day: asked })]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Person name={request.name ?? request.email} email={second} />
        {onDomain && (
          <Status appearance="pill" tone="success">
            {t("onDomain", { domain: onDomain })}
          </Status>
        )}
      </div>
      {request.message && (
        <figure className="flex flex-col gap-1 rounded-lg border-l-3 border-input bg-muted px-4 py-3">
          <figcaption className="text-xs text-muted-foreground">{t("message")}</figcaption>
          <blockquote className="text-sm break-words whitespace-pre-line">
            {request.message}
          </blockquote>
        </figure>
      )}
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t("foot")}</p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <OrganizationAction action="declineRequest" id={request.id} prominence="secondary">
            {t("decline")}
          </OrganizationAction>
          <OrganizationAction action="approveRequest" id={request.id} tone="success">
            {t("approve")}
          </OrganizationAction>
        </div>
      </div>
    </div>
  );
}

export { JoinRequestCard };
