"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { IconButton } from "@/components/actions/icon-button";
import { ChoiceChips } from "@/components/composites/choice-chips";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { ReviewReadiness } from "@/components/composites/review-readiness";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  saveMyTalentProfile,
  submitMyTalentProfile,
  type SaveTalentProfile,
  type TalentProfile,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
import { focusField } from "@/lib/focus-field";

import { availabilities, engagements, rateBands, talentRoles } from "./talent-codes";
import { talentError } from "./talent-errors";

const MAX_ROLES = 4;
const MAX_SKILLS = 15;
const MAX_PROJECTS = 6;

/** The fields the form checks, in its order, each with the id of its control. */
const reviewFields = [
  { field: "headline", id: "talent-headline" },
  { field: "bio", id: "talent-bio" },
  { field: "roles", id: "talent-roles" },
  { field: "skills", id: "talent-skills" },
] as const;
const checkedFields = [
  { field: "name", id: "talent-name" },
  ...reviewFields,
  { field: "projects", id: "talent-projects" },
];

type ProjectDraft = { key: number; title: string; year: string; url: string; summary: string };

type TalentFormProps = {
  /** The caller's profile; without one the first save creates it. */
  profile: TalentProfile | null;
  /** The name to start a new profile with, from the caller's account. */
  suggestedName: string;
};

/** The skills a person typed, one per comma or line, each once. */
function skillsOf(text: string) {
  return [
    ...new Set(
      text
        .split(/[,\n]/)
        .map((skill) => skill.trim())
        .filter(Boolean),
    ),
  ];
}

/** What the form holds for a profile as it was last saved, or for none. */
function saved(profile: TalentProfile | null, suggestedName: string) {
  return {
    text: {
      name: profile?.name ?? suggestedName,
      headline: profile?.headline ?? "",
      bio: profile?.bio ?? "",
      skills: profile?.skills.join(", ") ?? "",
      website: profile?.website ?? "",
    },
    chosen: { roles: profile?.roles ?? [], engagement: profile?.engagement ?? [] },
    picked: {
      country: profile?.country ?? "",
      availability: (profile?.availability ?? "") as string,
      rateBand: (profile?.rateBand ?? "") as string,
    },
    projects: (profile?.projects ?? []).map((project, key): ProjectDraft => ({
      key,
      title: project.title,
      year: project.year ? String(project.year) : "",
      url: project.url ?? "",
      summary: project.summary ?? "",
    })),
    listed: profile?.listed ?? true,
  };
}

/**
 * The editor of a person's own talent profile. Saving keeps it as it is; sending it for review saves
 * first, then asks for the review, and is offered for a draft or a rejected profile. A change to an
 * approved profile shows in the directory at once. What a review needs is listed above the buttons
 * from the start, and a refused attempt moves to the first field it lacks.
 */
function TalentForm({ profile, suggestedName }: TalentFormProps) {
  const t = useTranslations("Talent.form");
  const role = useVocabulary("talentRole");
  const availability = useVocabulary("availability");
  const engagement = useVocabulary("engagement");
  const rateBand = useVocabulary("rateBand");
  const countryName = useCountryName();
  const notify = useNotify();
  const router = useRouter();
  const initial = saved(profile, suggestedName);
  const [text, setText] = useState(initial.text);
  const [chosen, setChosen] = useState(initial.chosen);
  const [picked, setPicked] = useState(initial.picked);
  const [projects, setProjects] = useState(initial.projects);
  const [nextKey, setNextKey] = useState(projects.length);
  const [listed, setListed] = useState(initial.listed);
  const [pending, setPending] = useState<"save" | "submit" | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [discarding, setDiscarding] = useState(false);

  const submittable = !profile || profile.status === "draft" || profile.status === "rejected";
  const dirty =
    pending === null &&
    JSON.stringify({ text, chosen, picked, projects, listed }) !== JSON.stringify(initial);

  /** A field that changes is no longer marked: its message was about what it held before. */
  const settle = (field: string) =>
    setInvalid((current) => {
      if (!current.has(field)) {
        return current;
      }
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  const write =
    (field: keyof typeof text) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setText((current) => ({ ...current, [field]: event.target.value }));
      settle(field);
    };
  const choose = (field: keyof typeof chosen) => (value: string[]) => {
    setChosen((current) => ({ ...current, [field]: value }));
    settle(field);
  };
  const pick = (field: keyof typeof picked) => (event: React.ChangeEvent<HTMLSelectElement>) =>
    setPicked((current) => ({ ...current, [field]: event.target.value }));
  const bad = (field: string) => invalid.has(field) || undefined;

  function changeProject(key: number, field: keyof Omit<ProjectDraft, "key">, value: string) {
    setProjects((current) =>
      current.map((project) => (project.key === key ? { ...project, [field]: value } : project)),
    );
  }

  function discard() {
    setText(initial.text);
    setChosen(initial.chosen);
    setPicked(initial.picked);
    setProjects(initial.projects);
    setListed(initial.listed);
    setInvalid(new Set());
    setDiscarding(false);
  }

  /** What a review needs and the form does not hold yet; the backend checks the same. */
  function missingForReview() {
    const missing = new Set<string>();
    if (!text.headline.trim()) {
      missing.add("headline");
    }
    if (!text.bio.trim()) {
      missing.add("bio");
    }
    if (chosen.roles.length === 0) {
      missing.add("roles");
    }
    if (skillsOf(text.skills).length === 0) {
      missing.add("skills");
    }
    return missing;
  }

  function addProject() {
    setProjects((current) => [
      ...current,
      { key: nextKey, title: "", year: "", url: "", summary: "" },
    ]);
    setNextKey(nextKey + 1);
  }

  async function save(thenSubmit: boolean) {
    const skills = skillsOf(text.skills);
    const missing = new Set<string>(text.name.trim() ? [] : ["name"]);
    if (skills.length > MAX_SKILLS) {
      missing.add("skills");
    }
    if (projects.some((project) => !project.title.trim())) {
      missing.add("projects");
    }
    // A profile that is under review or published keeps what a review needs.
    if (thenSubmit || !submittable) {
      missingForReview().forEach((field) => missing.add(field));
    }
    setInvalid(missing);
    if (missing.size > 0) {
      focusField(checkedFields.find((entry) => missing.has(entry.field))?.id ?? "talent-name");
      notify.error(
        missing.has("name") || missing.has("projects")
          ? "Talent.errors.REQUEST_INVALID"
          : "Talent.errors.TALENT_INCOMPLETE",
      );
      return;
    }
    setPending(thenSubmit ? "submit" : "save");
    try {
      await saveMyTalentProfile({
        body: {
          name: text.name,
          headline: text.headline.trim() || null,
          bio: text.bio.trim() || null,
          roles: chosen.roles,
          skills,
          country: picked.country || null,
          availability: (picked.availability || undefined) as SaveTalentProfile["availability"],
          engagement: chosen.engagement,
          rateBand: (picked.rateBand || undefined) as SaveTalentProfile["rateBand"],
          website: text.website.trim() || null,
          projects: projects.map((project) => ({
            title: project.title,
            year: project.year ? Number(project.year) : null,
            url: project.url.trim() || null,
            summary: project.summary.trim() || null,
          })),
          listed,
          version: profile?.version ?? null,
        },
      });
      if (thenSubmit) {
        await submitMyTalentProfile();
      }
      notify.success(thenSubmit ? "Talent.done.submitted" : "Talent.done.saved");
      router.refresh();
    } catch (error) {
      setInvalid(rejectedFields(error));
      notify.error(talentError(error));
      // The save may have gone through before the submission was refused; the page shows which.
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const needed = (field: (typeof reviewFields)[number]["field"]) =>
    bad(field) && (
      <FieldError id={`${reviewFields.find((entry) => entry.field === field)?.id}-error`}>
        {t(`needed.${field}`)}
      </FieldError>
    );
  /** The hint and the error of a field, for the control they describe. */
  const about = (id: string) => `${id}-hint ${id}-error`;
  const lacking = missingForReview();
  /** What is still to add before a review, in the order of the form. */
  const toAdd = [
    ...(text.name.trim() ? [] : [{ id: "talent-name", label: t("name") }]),
    ...reviewFields
      .filter((entry) => lacking.has(entry.field))
      .map((entry) => ({ id: entry.id, label: t(entry.field) })),
  ];

  return (
    <form
      noValidate
      className="flex max-w-3xl flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <FieldGroup>
        <Field data-invalid={bad("name")}>
          <FieldLabel htmlFor="talent-name">
            {t("name")}{" "}
            <span className="font-normal text-muted-foreground">{t("requiredMark")}</span>
          </FieldLabel>
          <Input
            id="talent-name"
            autoComplete="name"
            maxLength={120}
            value={text.name}
            onChange={write("name")}
            aria-required
            aria-invalid={bad("name")}
          />
          {bad("name") && <FieldError>{t("nameRequired")}</FieldError>}
        </Field>
        <Field data-invalid={bad("headline")}>
          <FieldLabel htmlFor="talent-headline">
            {t("headline")}{" "}
            <span className="font-normal text-muted-foreground">
              {t(submittable ? "neededMark" : "requiredMark")}
            </span>
          </FieldLabel>
          <Input
            id="talent-headline"
            aria-describedby={about("talent-headline")}
            maxLength={160}
            value={text.headline}
            onChange={write("headline")}
            aria-required
            aria-invalid={bad("headline")}
          />
          {needed("headline")}
          <FieldDescription id="talent-headline-hint">{t("headlineHint")}</FieldDescription>
        </Field>
        <Field data-invalid={bad("bio")}>
          <FieldLabel htmlFor="talent-bio">
            {t("bio")}{" "}
            <span className="font-normal text-muted-foreground">
              {t(submittable ? "neededMark" : "requiredMark")}
            </span>
          </FieldLabel>
          <Textarea
            id="talent-bio"
            aria-describedby={about("talent-bio")}
            rows={6}
            maxLength={4000}
            value={text.bio}
            onChange={write("bio")}
            aria-required
            aria-invalid={bad("bio")}
          />
          {needed("bio")}
          <FieldDescription id="talent-bio-hint">{t("bioHint")}</FieldDescription>
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field data-invalid={bad("roles")}>
          <FieldLabel>
            {t("roles")}{" "}
            <span className="font-normal text-muted-foreground">
              {t(submittable ? "neededMark" : "requiredMark")}
            </span>
          </FieldLabel>
          <ChoiceChips
            id="talent-roles"
            aria-describedby={about("talent-roles")}
            label={t("roles")}
            options={talentRoles.map((value) => ({ value, label: role(value) }))}
            value={chosen.roles}
            onValueChange={choose("roles")}
            max={MAX_ROLES}
          />
          {needed("roles")}
          <FieldDescription id="talent-roles-hint">
            {t("upTo", { count: MAX_ROLES, chosen: chosen.roles.length })}
          </FieldDescription>
        </Field>
        <Field data-invalid={bad("skills")}>
          <FieldLabel htmlFor="talent-skills">
            {t("skills")}{" "}
            <span className="font-normal text-muted-foreground">
              {t(submittable ? "neededMark" : "requiredMark")}
            </span>
          </FieldLabel>
          <Input
            id="talent-skills"
            aria-describedby={about("talent-skills")}
            value={text.skills}
            onChange={write("skills")}
            aria-required
            aria-invalid={bad("skills")}
          />
          {bad("skills") && skillsOf(text.skills).length > 0 ? (
            <FieldError id="talent-skills-error">
              {t("skillsInvalid", { count: MAX_SKILLS })}
            </FieldError>
          ) : (
            needed("skills")
          )}
          <FieldDescription id="talent-skills-hint">
            {t("skillsHint", { count: MAX_SKILLS })}
          </FieldDescription>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="talent-country">{t("country")}</FieldLabel>
            <NativeSelect
              id="talent-country"
              className="w-full"
              value={picked.country}
              onChange={pick("country")}
            >
              <NativeSelectOption value="">{t("notStated")}</NativeSelectOption>
              {countryCodes.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {countryName(value)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="talent-availability">{t("availability")}</FieldLabel>
            <NativeSelect
              id="talent-availability"
              className="w-full"
              value={picked.availability}
              onChange={pick("availability")}
            >
              <NativeSelectOption value="">{t("notStated")}</NativeSelectOption>
              {availabilities.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {availability(value)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="talent-rate">{t("rate")}</FieldLabel>
            <NativeSelect
              id="talent-rate"
              className="w-full"
              value={picked.rateBand}
              onChange={pick("rateBand")}
            >
              <NativeSelectOption value="">{t("notStated")}</NativeSelectOption>
              {rateBands.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {rateBand(value)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel>{t("engagement")}</FieldLabel>
          <ChoiceChips
            label={t("engagement")}
            options={engagements.map((value) => ({ value, label: engagement(value) }))}
            value={chosen.engagement}
            onValueChange={choose("engagement")}
          />
        </Field>
        <Field data-invalid={bad("website")}>
          <FieldLabel htmlFor="talent-website">{t("website")}</FieldLabel>
          <Input
            id="talent-website"
            type="url"
            inputMode="url"
            placeholder="https://"
            maxLength={300}
            value={text.website}
            onChange={write("website")}
            aria-invalid={bad("website")}
          />
          {bad("website") ? (
            <FieldError>{t("websiteInvalid")}</FieldError>
          ) : (
            <FieldDescription>{t("websiteHint")}</FieldDescription>
          )}
        </Field>
      </FieldGroup>

      <FieldSet>
        <FieldLegend>{t("projects.title")}</FieldLegend>
        <FieldDescription>{t("projects.lead", { count: MAX_PROJECTS })}</FieldDescription>
        {bad("projects") && <FieldError>{t("projects.titleRequired")}</FieldError>}
        <ul id="talent-projects" className="flex flex-col gap-4">
          {projects.map((project, index) => (
            <li key={project.key} className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-4">
                  <Field className="sm:col-span-3">
                    <FieldLabel htmlFor={`project-title-${project.key}`}>
                      {t("projects.name", { number: index + 1 })}
                    </FieldLabel>
                    <Input
                      id={`project-title-${project.key}`}
                      maxLength={120}
                      value={project.title}
                      onChange={(event) => {
                        changeProject(project.key, "title", event.target.value);
                        settle("projects");
                      }}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`project-year-${project.key}`}>
                      {t("projects.year")}
                    </FieldLabel>
                    <Input
                      id={`project-year-${project.key}`}
                      type="number"
                      inputMode="numeric"
                      min={1990}
                      max={2100}
                      value={project.year}
                      onChange={(event) => changeProject(project.key, "year", event.target.value)}
                    />
                  </Field>
                </div>
                <IconButton
                  aria-label={t("projects.remove", { number: index + 1 })}
                  onClick={() =>
                    setProjects((current) => current.filter((other) => other !== project))
                  }
                >
                  <Trash2Icon aria-hidden="true" />
                </IconButton>
              </div>
              <Field>
                <FieldLabel htmlFor={`project-summary-${project.key}`}>
                  {t("projects.summary")}
                </FieldLabel>
                <Textarea
                  id={`project-summary-${project.key}`}
                  rows={2}
                  maxLength={600}
                  value={project.summary}
                  onChange={(event) => changeProject(project.key, "summary", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`project-url-${project.key}`}>{t("projects.url")}</FieldLabel>
                <Input
                  id={`project-url-${project.key}`}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  maxLength={300}
                  value={project.url}
                  onChange={(event) => changeProject(project.key, "url", event.target.value)}
                />
              </Field>
            </li>
          ))}
        </ul>
        {projects.length < MAX_PROJECTS && (
          <Button prominence="secondary" size="sm" className="self-start" onClick={addProject}>
            <PlusIcon aria-hidden="true" />
            {t("projects.add")}
          </Button>
        )}
      </FieldSet>

      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="talent-listed">{t("listed")}</FieldLabel>
          <FieldDescription>
            {t(profile?.status === "approved" ? "listedHintApproved" : "listedHint")}
          </FieldDescription>
        </FieldContent>
        <Switch id="talent-listed" checked={listed} onCheckedChange={setListed} />
      </Field>

      {submittable && (
        <ReviewReadiness
          missingTitle={t("readiness.missing")}
          readyTitle={t("readiness.ready")}
          note={t("readiness.note")}
          missing={toAdd}
          refused={invalid.has("name") || reviewFields.some((entry) => invalid.has(entry.field))}
        />
      )}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t bg-background py-4">
        {submittable && (
          <Button
            pending={pending === "submit"}
            disabled={pending !== null}
            onClick={() => save(true)}
          >
            {t(profile?.status === "rejected" ? "resubmit" : "submit")}
          </Button>
        )}
        <Button
          type="submit"
          prominence={submittable ? "secondary" : "primary"}
          pending={pending === "save"}
          disabled={pending !== null || !dirty}
        >
          {t(submittable ? "saveDraft" : "save")}
        </Button>
        {submittable && toAdd.length > 0 && (
          <TextButton onClick={() => focusField(toAdd[0].id)}>
            {t("readiness.count", { count: toAdd.length })}
          </TextButton>
        )}
        {dirty && (
          <>
            <Button prominence="tertiary" onClick={() => setDiscarding(true)}>
              {t("discard")}
            </Button>
            <span className="text-sm text-muted-foreground">{t("unsaved")}</span>
          </>
        )}
      </div>
      <LeaveGuard
        active={dirty}
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
      {discarding && (
        <ConfirmDialog
          open
          onOpenChange={setDiscarding}
          title={t("confirmDiscard.title")}
          description={t("confirmDiscard.lead")}
          confirmLabel={t("discard")}
          cancelLabel={t("confirmDiscard.cancel")}
          tone="danger"
          pending={false}
          onConfirm={discard}
        />
      )}
    </form>
  );
}

export { TalentForm };
