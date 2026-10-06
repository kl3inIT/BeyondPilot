import { useTranslations } from "next-intl";

import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { MyOrganization, Organization } from "@/lib/api/generated";

import { OrganizationForm } from "./organization-form";
import { OrganizationFrame } from "./organization-frame";

type OrganizationProfilePageProps = {
  mine: MyOrganization & { organization: Organization };
  counts: { members: number; solutions: number | null };
};

/**
 * My organization › Profile. An owner changes it; a member reads it. Saving a refused organization
 * sends it to review again, which the frame's notice says.
 */
function OrganizationProfilePage({ mine, counts }: OrganizationProfilePageProps) {
  const t = useTranslations("Organization.form");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const industryName = useVocabulary("industry");
  const countryName = useCountryName();
  const { organization } = mine;

  const facts = [
    { label: t("name"), value: organization.name },
    { label: t("website"), value: organization.website },
    { label: t("emailDomain"), value: organization.emailDomain },
    { label: t("type"), value: typeName(organization.type) },
    { label: t("teamSize"), value: organization.teamSize && sizeName(organization.teamSize) },
    { label: t("industries"), value: organization.industries.map(industryName).join(", ") },
    { label: t("country"), value: organization.country && countryName(organization.country) },
    { label: t("description"), value: organization.description },
  ];

  return (
    <OrganizationFrame mine={mine} current="profile" counts={counts}>
      {mine.role === "owner" ? (
        // The key gives a saved organization a fresh form, so it holds the new version.
        <OrganizationForm key={organization.version} organization={organization} />
      ) : (
        <div className="flex flex-col gap-7 rounded-3xl border bg-card p-5 md:p-10">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-semibold tracking-title">{t("profileTitle")}</h2>
            <p className="text-muted-foreground">{t("profileLead")}</p>
          </div>
          <dl className="grid gap-x-6 gap-y-4 border-t pt-6 sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label} className="contents">
                <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                <dd className="text-sm break-words whitespace-pre-line sm:col-span-2">
                  {fact.value || t("notStated")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </OrganizationFrame>
  );
}

export { OrganizationProfilePage };
