"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ChoiceCombobox } from "@/components/composites/choice-combobox";
import { ChoiceSelect } from "@/components/composites/choice-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import { createAdminOrganization, type AdminCreateOrganization } from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";

import { industries, organizationTypes, teamSizes } from "./organization-codes";
import { organizationError } from "./organization-errors";
import { MAX_DESCRIPTION, MAX_INDUSTRIES, yearOf } from "./organization-format";
import { OrganizationLogoUpload } from "./organization-logo-upload";
import { useVerifiedDomain } from "./verified-domain";

const blank = {
  name: "",
  type: "",
  website: "",
  ownerEmail: "",
  country: "",
  teamSize: "",
  foundedYear: "",
  description: "",
  logoFileId: "",
};

/** The red star after the label of a field that must be filled; screen readers hear the error instead. */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

/**
 * Creates an organization on behalf of its people, already approved: GenAI Fund lists a company
 * before anyone from it signs in. Only the name and the type are needed; whatever else the operator
 * knows is filled in now, and the rest is left to the owner. With an owner's address, that person is
 * invited to own it; without one, the first person on its email domain owns it, or someone claims it.
 */
function AdminCreateOrganization() {
  const t = useTranslations("Admin.organizations.create");
  const f = useTranslations("Organization.form");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const industryName = useVocabulary("industry");
  const countryName = useCountryName();
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(blank);
  const [chosenIndustries, setChosenIndustries] = useState<string[]>([]);
  const domain = useVerifiedDomain(null);
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());

  const set = (field: keyof typeof blank) => (value: string) =>
    setText((current) => ({ ...current, [field]: value }));
  const write = (field: keyof typeof blank) => (event: React.ChangeEvent<HTMLInputElement>) =>
    set(field)(event.target.value);
  const bad = (field: string) => invalid.has(field) || undefined;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = new Set<string>();
    if (!text.name.trim()) {
      missing.add("name");
    }
    if (!text.type) {
      missing.add("type");
    }
    const year = text.foundedYear.trim() ? yearOf(text.foundedYear) : null;
    if (text.foundedYear.trim() && year === null) {
      missing.add("foundedYear");
    }
    const emailDomain = domain.read();
    setInvalid(missing);
    if (missing.size > 0 || emailDomain === undefined) {
      return;
    }
    setPending(true);
    try {
      await createAdminOrganization({
        body: {
          name: text.name,
          type: text.type as AdminCreateOrganization["type"],
          website: text.website.trim() || null,
          country: text.country || null,
          teamSize: (text.teamSize || null) as AdminCreateOrganization["teamSize"],
          industries: chosenIndustries.length > 0 ? chosenIndustries : null,
          description: text.description.trim() || null,
          foundedYear: year,
          logoFileId: text.logoFileId || null,
          emailDomain,
          ownerEmail: text.ownerEmail.trim() || null,
        },
      });
      notify.success("Organization.done.adminCreated", { name: text.name.trim() });
      setOpen(false);
      setText(blank);
      setChosenIndustries([]);
      domain.change("");
      router.refresh();
    } catch (error) {
      setInvalid(rejectedFields(error));
      if (!domain.refused(error)) {
        notify.error(organizationError(error));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false} className="max-h-dvh overflow-y-auto sm:max-w-3xl">
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle size="lg">{t("title")}</DialogTitle>
            </DialogHeader>
            <FieldGroup>
              <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
                <Field data-invalid={bad("name")}>
                  <FieldLabel htmlFor="admin-organization-name">
                    {t("name")}
                    <RequiredMark />
                  </FieldLabel>
                  <Input
                    id="admin-organization-name"
                    maxLength={120}
                    value={text.name}
                    onChange={write("name")}
                    aria-invalid={bad("name")}
                  />
                  {bad("name") && <FieldError>{t("nameRequired")}</FieldError>}
                </Field>
                <Field data-invalid={bad("type")}>
                  <FieldLabel htmlFor="admin-organization-type">
                    {t("type")}
                    <RequiredMark />
                  </FieldLabel>
                  <ChoiceSelect
                    id="admin-organization-type"
                    placeholder={t("typePlaceholder")}
                    options={organizationTypes.map((value) => ({ value, label: typeName(value) }))}
                    value={text.type}
                    onValueChange={set("type")}
                    aria-invalid={bad("type")}
                  />
                  {bad("type") && <FieldError>{t("typeRequired")}</FieldError>}
                </Field>
                <Field data-invalid={bad("website")}>
                  <FieldLabel htmlFor="admin-organization-website">{t("website")}</FieldLabel>
                  <Input
                    id="admin-organization-website"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    maxLength={300}
                    value={text.website}
                    onChange={write("website")}
                    aria-invalid={bad("website")}
                  />
                  {bad("website") && <FieldError>{t("websiteInvalid")}</FieldError>}
                </Field>
                <Field data-invalid={bad("ownerEmail")}>
                  <FieldLabel htmlFor="admin-organization-owner">{t("ownerEmail")}</FieldLabel>
                  <Input
                    id="admin-organization-owner"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={254}
                    value={text.ownerEmail}
                    onChange={write("ownerEmail")}
                    aria-invalid={bad("ownerEmail")}
                  />
                  {bad("ownerEmail") && <FieldError>{t("ownerEmailInvalid")}</FieldError>}
                </Field>
                <Field data-invalid={domain.problem !== null || undefined}>
                  <FieldLabel htmlFor="admin-organization-domain">{t("emailDomain")}</FieldLabel>
                  <Input
                    id="admin-organization-domain"
                    inputMode="url"
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={253}
                    placeholder="example.com"
                    value={domain.text}
                    aria-invalid={domain.problem !== null || undefined}
                    onChange={(event) => domain.change(event.target.value)}
                  />
                  {domain.problem && <FieldError>{f(`domain.${domain.problem}`)}</FieldError>}
                </Field>
                <Field data-invalid={bad("country")}>
                  <FieldLabel htmlFor="admin-organization-country">{f("country")}</FieldLabel>
                  <ChoiceSelect
                    id="admin-organization-country"
                    placeholder={f("countryPlaceholder")}
                    options={countryCodes.map((value) => ({ value, label: countryName(value) }))}
                    value={text.country}
                    onValueChange={set("country")}
                    aria-invalid={bad("country")}
                  />
                </Field>
                <Field data-invalid={bad("teamSize")}>
                  <FieldLabel htmlFor="admin-organization-team-size">{f("teamSize")}</FieldLabel>
                  <ChoiceSelect
                    id="admin-organization-team-size"
                    placeholder={f("teamSizePlaceholder")}
                    options={teamSizes.map((value) => ({ value, label: sizeName(value) }))}
                    value={text.teamSize}
                    onValueChange={set("teamSize")}
                    aria-invalid={bad("teamSize")}
                  />
                </Field>
                <Field data-invalid={bad("foundedYear")}>
                  <FieldLabel htmlFor="admin-organization-founded-year">
                    {f("foundedYear")}
                  </FieldLabel>
                  <Input
                    id="admin-organization-founded-year"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="2021"
                    value={text.foundedYear}
                    onChange={write("foundedYear")}
                    aria-invalid={bad("foundedYear")}
                  />
                  {bad("foundedYear") && <FieldError>{f("foundedYearInvalid")}</FieldError>}
                </Field>
              </div>
              <Field data-invalid={bad("industries")}>
                <FieldLabel htmlFor="admin-organization-industries">{f("industries")}</FieldLabel>
                <ChoiceCombobox
                  id="admin-organization-industries"
                  label={f("industries")}
                  placeholder={f("industriesPlaceholder")}
                  emptyLabel={f("industriesEmpty")}
                  removeLabel={(industry) => f("industriesRemove", { industry })}
                  aria-invalid={bad("industries")}
                  options={industries.map((value) => ({ value, label: industryName(value) }))}
                  value={chosenIndustries}
                  onValueChange={setChosenIndustries}
                  max={MAX_INDUSTRIES}
                />
              </Field>
              <Field data-invalid={bad("description")}>
                <FieldLabel htmlFor="admin-organization-description">{f("description")}</FieldLabel>
                <Textarea
                  id="admin-organization-description"
                  rows={3}
                  maxLength={MAX_DESCRIPTION}
                  value={text.description}
                  onChange={(event) => set("description")(event.target.value)}
                  aria-invalid={bad("description")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="organization-logo">{f("logo.label")}</FieldLabel>
                <OrganizationLogoUpload value={text.logoFileId} onChange={set("logoFileId")} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button prominence="secondary" disabled={pending} onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" pending={pending}>
                {t("confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { AdminCreateOrganization };
