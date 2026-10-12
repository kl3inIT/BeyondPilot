"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import { organizeUseCaseProposal, type ProposingOrganization } from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { siteRoutes } from "@/lib/site";
import { publicFileUrl } from "@/lib/storage/upload";

import { describeProposalError } from "./proposal-errors";

/** The sizes a team names. */
const teamSizes = ["2_9", "10_49", "50_99"] as const;

type ProposalOrganizationStepProps = {
  useCaseId: string;
  /** The organization the proposal is sent for; none yet for a person who belongs to no organization. */
  organization: ProposingOrganization | null;
  /** The name of the caller's account, for an organization of one person. */
  accountName: string;
};

/** The organization the proposal is sent for, or the few lines that make one for a person in none. */
function ProposalOrganizationStep({
  useCaseId,
  organization,
  accountName,
}: ProposalOrganizationStepProps) {
  if (!organization) {
    return <NewOrganization useCaseId={useCaseId} accountName={accountName} />;
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <Avatar size="lg">
        {organization.logoFileId && (
          <AvatarImage src={publicFileUrl(organization.logoFileId)} alt="" />
        )}
        <AvatarFallback>{initials(organization.name, "")}</AvatarFallback>
      </Avatar>
      <span className="truncate text-base font-medium">{organization.name}</span>
    </div>
  );
}

type Kind = "individual" | "team";

/**
 * Makes the organization a person sends the proposal for: themselves on their own, or their team. It waits
 * for GenAI Fund's review, which does not hold the proposal up.
 */
function NewOrganization({
  useCaseId,
  accountName,
}: Omit<ProposalOrganizationStepProps, "organization">) {
  const t = useTranslations("UseCaseProposal.wizard.organization");
  const notify = useNotify();
  const router = useRouter();
  const countryName = useCountryName();
  const sizeName = useVocabulary("teamSize");
  const [kind, setKind] = useState<Kind>("individual");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [size, setSize] = useState<string>("2_9");
  const [website, setWebsite] = useState("");
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);

  const team = kind === "team";
  const nameMissing = tried && team && name.trim() === "";
  const countryMissing = tried && country === "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if ((team && name.trim() === "") || country === "") {
      return;
    }
    setPending(true);
    try {
      await organizeUseCaseProposal({
        path: { useCaseId },
        body: team
          ? {
              kind: "team",
              name: name.trim(),
              country,
              teamSize: size as "2_9",
              website: website.trim() || null,
            }
          : { kind: "individual", name: accountName, country },
      });
      router.refresh();
    } catch (error) {
      notify.error(describeProposalError(error));
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <RadioGroup
        value={kind}
        onValueChange={(value) => setKind(value as Kind)}
        aria-label={t("kind")}
      >
        {(["individual", "team"] as const).map((choice) => (
          <FieldLabel key={choice} htmlFor={`proposal-kind-${choice}`}>
            <Field orientation="horizontal">
              <span className="text-sm font-medium">{t(choice)}</span>
              <RadioGroupItem value={choice} id={`proposal-kind-${choice}`} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>

      {team && (
        <Field data-invalid={nameMissing || undefined}>
          <FieldLabel htmlFor="proposal-team-name">{t("teamName")}</FieldLabel>
          <Input
            id="proposal-team-name"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameMissing || undefined}
          />
          {nameMissing && <FieldError>{t("required")}</FieldError>}
        </Field>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field data-invalid={countryMissing || undefined}>
          <FieldLabel htmlFor="proposal-country">{t("country")}</FieldLabel>
          <NativeSelect
            id="proposal-country"
            className="w-full"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            aria-invalid={countryMissing || undefined}
          >
            <NativeSelectOption value="">{t("countryPlaceholder")}</NativeSelectOption>
            {countryCodes.map((code) => (
              <NativeSelectOption key={code} value={code}>
                {countryName(code)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {countryMissing && <FieldError>{t("required")}</FieldError>}
        </Field>
        {team && (
          <Field>
            <FieldLabel htmlFor="proposal-team-size">{t("teamSize")}</FieldLabel>
            <NativeSelect
              id="proposal-team-size"
              className="w-full"
              value={size}
              onChange={(event) => setSize(event.target.value)}
            >
              {teamSizes.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {sizeName(option)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>

      {team && (
        <Field>
          <FieldLabel htmlFor="proposal-website">{t("website")}</FieldLabel>
          <Input
            id="proposal-website"
            type="url"
            inputMode="url"
            maxLength={300}
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </Field>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <TextButton href={siteRoutes.workspaceOrganization}>{t("existing")}</TextButton>
        <Button type="submit" size="lg" pending={pending}>
          {t("continue")}
        </Button>
      </div>
    </form>
  );
}

export { ProposalOrganizationStep };
