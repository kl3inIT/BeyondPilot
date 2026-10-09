import { Building2Icon, FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { Organization } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

import { OrganizationProfileSection } from "./organization-profile-section";

type OrganizationProfileViewProps = {
  organization: Organization;
  /** Beside the title, for whoever may change the profile: the way into the form. */
  action?: React.ReactNode;
};

type Fact = {
  label: string;
  value: string | null | undefined;
  wide?: boolean;
  /** Where the value leads when it is an address outside BeyondPilot. */
  href?: string | null;
};

/** Facts laid out as the form lays out their fields; a fact never given says so. */
function Facts({ facts }: { facts: Fact[] }) {
  const t = useTranslations("Organization.form");
  return (
    <dl className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className={cn("flex flex-col gap-1.5", fact.wide && "sm:col-span-2")}>
          <dt className="text-sm font-semibold">{fact.label}</dt>
          <dd className="text-sm break-words whitespace-pre-line text-muted-foreground">
            {fact.value && fact.href ? (
              <TextButton href={fact.href} target="_blank" rel="noreferrer">
                {fact.value}
              </TextButton>
            ) : (
              fact.value || t("notStated")
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** An organization's profile as it reads, in the groups and places of the form that edits it. */
function OrganizationProfileView({ organization, action }: OrganizationProfileViewProps) {
  const t = useTranslations("Organization.form");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const industryName = useVocabulary("industry");
  const countryName = useCountryName();

  return (
    <div className="flex flex-col gap-5 rounded-3xl border bg-card p-5 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-title">{t("profileTitle")}</h2>
        {action}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <OrganizationProfileSection icon={Building2Icon} title={t("basics")}>
          <Facts
            facts={[
              { label: t("name"), value: organization.name },
              { label: t("website"), value: organization.website, href: organization.website },
              { label: t("emailDomain"), value: organization.emailDomain, wide: true },
              { label: t("type"), value: typeName(organization.type) },
              {
                label: t("teamSize"),
                value: organization.teamSize && sizeName(organization.teamSize),
              },
            ]}
          />
        </OrganizationProfileSection>
        <OrganizationProfileSection icon={FileTextIcon} title={t("about")}>
          <Facts
            facts={[
              {
                label: t("industries"),
                value: organization.industries.map(industryName).join(", "),
                wide: true,
              },
              {
                label: t("country"),
                value: organization.country && countryName(organization.country),
              },
              { label: t("foundedYear"), value: organization.foundedYear?.toString() },
              { label: t("description"), value: organization.description, wide: true },
            ]}
          />
        </OrganizationProfileSection>
      </div>
    </div>
  );
}

export { OrganizationProfileView };
