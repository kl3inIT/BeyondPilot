import { ArrowLeftIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { Person } from "@/components/composites/person";
import { ReviewStatus } from "@/components/composites/review-status";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { AdminOrganization } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { ClaimDecisionButton } from "./claim-decision";
import { MemberRole } from "./member-role";
import { OrganizationReviewButton } from "./organization-review";

/**
 * Admin › Organisations › one organization: what its people wrote, who belongs, and what an operator
 * decides: the review of a new organization, and a claim on one nobody owns.
 */
function AdminOrganizationPage({ detail }: { detail: AdminOrganization }) {
  const t = useTranslations("Admin.organizations.detail");
  const s = useTranslations("Organization.status");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const industryName = useVocabulary("industry");
  const reasonName = useVocabulary("organizationRefusal");
  const countryName = useCountryName();
  const format = useFormatter();
  const locale = useLocale();
  const { organization } = detail;

  const facts = [
    { label: t("type"), value: typeName(organization.type) },
    { label: t("country"), value: organization.country && countryName(organization.country) },
    { label: t("teamSize"), value: organization.teamSize && sizeName(organization.teamSize) },
    { label: t("industries"), value: organization.industries.map(industryName).join(", ") },
    { label: t("website"), value: organization.website },
    { label: t("emailDomain"), value: organization.emailDomain },
    {
      label: t("createdBy"),
      value: t("createdByOn", {
        name: detail.createdBy,
        day: format.dateTime(new Date(organization.createdAt), { dateStyle: "medium" }),
      }),
    },
    { label: t("description"), value: organization.description },
  ];

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
          <ReviewStatus state={organization.status}>{s(organization.status)}</ReviewStatus>
        </div>
        {organization.status === "pending" && (
          <OrganizationReviewButton organization={organization} />
        )}
      </div>

      {organization.status === "rejected" && (
        <p className="rounded-lg border bg-muted p-3 text-sm">
          <span className="font-medium">
            {t("refused", { reason: reasonName(organization.decisionReason ?? "other") })}
          </span>
          {organization.decisionMessage && <> {organization.decisionMessage}</>}
        </p>
      )}

      <div className="grid gap-10 lg:grid-cols-3">
        <dl className="grid content-start gap-x-6 gap-y-4 sm:grid-cols-3 lg:col-span-2">
          {facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-sm text-muted-foreground">{fact.label}</dt>
              <dd className="text-sm break-words whitespace-pre-line sm:col-span-2">
                {fact.value || t("notStated")}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-8">
          {detail.claims.length > 0 && (
            <section aria-labelledby="organization-claims" className="flex flex-col gap-3">
              <h2 id="organization-claims" className="text-sm font-semibold">
                {t("claims")}
              </h2>
              <ul className="overflow-hidden rounded-lg border">
                {detail.claims.map((claim) => (
                  <li key={claim.id} className="flex flex-col gap-3 border-b p-3 last:border-b-0">
                    <Person name={claim.name ?? null} email={claim.email} />
                    {claim.message && (
                      <p className="text-sm text-muted-foreground">{claim.message}</p>
                    )}
                    <div>
                      <ClaimDecisionButton organization={organization} claimId={claim.id} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="organization-people" className="flex flex-col gap-3">
            <h2 id="organization-people" className="text-sm font-semibold">
              {t("members", { count: detail.members.length })}
            </h2>
            {detail.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
            ) : (
              <ul className="overflow-hidden rounded-lg border">
                {detail.members.map((member) => (
                  <li
                    key={member.accountId}
                    className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0"
                  >
                    <Person name={member.name ?? null} email={member.email} />
                    <MemberRole role={member.role} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {detail.invitations.length > 0 && (
            <section aria-labelledby="organization-invited" className="flex flex-col gap-3">
              <h2 id="organization-invited" className="text-sm font-semibold">
                {t("invitations")}
              </h2>
              <ul className="overflow-hidden rounded-lg border">
                {detail.invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex items-center justify-between gap-3 border-b p-3 text-sm last:border-b-0"
                  >
                    <span className="truncate">{invitation.email}</span>
                    <MemberRole role={invitation.role} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export { AdminOrganizationPage };
