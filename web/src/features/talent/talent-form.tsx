"use client";

import { EyeOffIcon, GlobeIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { IconButton } from "@/components/actions/icon-button";
import { ChoiceChips } from "@/components/composites/choice-chips";
import { ChoiceCombobox } from "@/components/composites/choice-combobox";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { RequiredMark } from "@/components/composites/required-mark";
import { ReviewReadiness } from "@/components/composites/review-readiness";
import { TagInput } from "@/components/composites/tag-input";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  saveMyTalentProfile,
  submitMyTalentProfile,
  type SaveTalentProfile,
  type TalentProfile,
  type TalentProject,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
import { focusField } from "@/lib/focus-field";

import { industries } from "@/features/organization/organization-codes";

import {
  engagements,
  languageCodes,
  projectStages,
  rateBands,
  suggestedSkills,
  talentRoles,
} from "./talent-codes";
import { talentError } from "./talent-errors";
import { TalentPhotoUpload } from "./talent-photo-upload";

const MAX_ROLES = 4;
const MAX_SKILLS = 15;
const MAX_SKILL_LENGTH = 40;
const MAX_PROJECTS = 6;
const MAX_LANGUAGES = 6;
const MAX_INDUSTRIES = 5;
const MAX_BIO = 4000;

/** The fields the form checks, in its order, each with the id of its control. */
const reviewFields = [
  { field: "headline", id: "talent-headline" },
  { field: "roles", id: "talent-roles" },
  { field: "skills", id: "talent-skills" },
  { field: "bio", id: "talent-bio" },
] as const;
const checkedFields = [
  { field: "name", id: "talent-name" },
  ...reviewFields,
  { field: "projects", id: "talent-projects" },
];

type ProjectDraft = {
  key: number;
  title: string;
  year: string;
  url: string;
  summary: string;
  stage: string;
};

type TalentFormProps = {
  /** The caller's profile; without one the first save creates it. */
  profile: TalentProfile | null;
  /** The name to start a new profile with, from the caller's account. */
  suggestedName: string;
};

/** What the form holds for a profile as it was last saved, or for none. */
function saved(profile: TalentProfile | null, suggestedName: string) {
  return {
    text: {
      name: profile?.name ?? suggestedName,
      headline: profile?.headline ?? "",
      bio: profile?.bio ?? "",
      website: profile?.website ?? "",
      city: profile?.city ?? "",
      worksAt: profile?.worksAt ?? "",
    },
    chosen: {
      roles: profile?.roles ?? [],
      skills: profile?.skills ?? [],
      engagement: profile?.engagement ?? [],
      languages: profile?.languages ?? [],
      industries: profile?.industries ?? [],
    },
    photo: profile?.photoFileId ?? "",
    picked: {
      country: profile?.country ?? "",
      rateBand: (profile?.rateBand ?? "") as string,
    },
    projects: (profile?.projects ?? []).map((project, key): ProjectDraft => ({
      key,
      title: project.title,
      year: project.year ? String(project.year) : "",
      url: project.url ?? "",
      summary: project.summary ?? "",
      stage: project.stage ?? "",
    })),
    listed: profile?.listed ?? true,
  };
}

/**
 * The editor of a person's own talent profile, as the Figma frame "My talent profile — edit, draft
 * saved" draws it: one card in groups, a field marked Optional when it can stay empty, and the
 * actions at its foot. Saving keeps it as it is; sending it for review saves first, then asks for the
 * review, and is offered for a draft or a profile GenAI Fund sent back. A change to an approved
 * profile shows in the directory at once. What a review needs is listed above the actions from the
 * start, and a refused attempt moves to the first field it lacks.
 *
 * A short vocabulary is a row of chips read whole (roles, the work a person takes on), a long one a
 * combobox that narrows as one types (industries, languages), and skills are free words kept as
 * tags.
 */
function TalentForm({ profile, suggestedName }: TalentFormProps) {
  const t = useTranslations("Talent.form");
  const role = useVocabulary("talentRole");
  const engagement = useVocabulary("engagement");
  const rateBand = useVocabulary("rateBand");
  const countryName = useCountryName();
  const language = useVocabulary("language");
  const industry = useVocabulary("industry");
  const stage = useVocabulary("projectStage");
  const notify = useNotify();
  const router = useRouter();
  const initial = saved(profile, suggestedName);
  const [text, setText] = useState(initial.text);
  const [chosen, setChosen] = useState(initial.chosen);
  const [photo, setPhoto] = useState(initial.photo);
  const [picked, setPicked] = useState(initial.picked);
  const [projects, setProjects] = useState(initial.projects);
  const [nextKey, setNextKey] = useState(projects.length);
  const [listed, setListed] = useState(initial.listed);
  const [pending, setPending] = useState<"save" | "submit" | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());

  // Sent back, or taken down after approval: either way the person corrects it and sends it again.
  const returned =
    profile?.status === "needs_changes" ||
    (profile?.status === "approved" && Boolean(profile.suspendedAt));
  const submittable = !profile || profile.status === "draft" || returned;
  const dirty =
    pending === null &&
    JSON.stringify({ text, chosen, photo, picked, projects, listed }) !== JSON.stringify(initial);

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

  /** What a review needs and the form does not hold yet; the backend checks the same. */
  function missingForReview() {
    const missing = new Set<string>();
    if (!text.headline.trim()) {
      missing.add("headline");
    }
    if (chosen.roles.length === 0) {
      missing.add("roles");
    }
    if (chosen.skills.length === 0) {
      missing.add("skills");
    }
    if (!text.bio.trim()) {
      missing.add("bio");
    }
    return missing;
  }

  function addProject() {
    setProjects((current) => [
      ...current,
      { key: nextKey, title: "", year: "", url: "", summary: "", stage: "" },
    ]);
    setNextKey(nextKey + 1);
    focusField(`project-title-${nextKey}`);
  }

  async function save(thenSubmit: boolean) {
    const missing = new Set<string>(text.name.trim() ? [] : ["name"]);
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
          skills: chosen.skills,
          country: picked.country || null,
          engagement: chosen.engagement,
          rateBand: (picked.rateBand || undefined) as SaveTalentProfile["rateBand"],
          website: text.website.trim() || null,
          photoFileId: photo || null,
          city: text.city.trim() || null,
          languages: chosen.languages as SaveTalentProfile["languages"],
          industries: chosen.industries as SaveTalentProfile["industries"],
          worksAt: text.worksAt.trim() || null,
          projects: projects.map((project) => ({
            title: project.title,
            year: project.year ? Number(project.year) : null,
            url: project.url.trim() || null,
            summary: project.summary.trim() || null,
            stage: (project.stage || null) as TalentProject["stage"],
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
  const optional = (
    <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
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
  const group = "border-t pt-6 text-lg font-semibold";

  return (
    <form
      noValidate
      aria-labelledby="talent-form-title"
      className="flex flex-col gap-7 rounded-3xl border bg-card p-5 md:p-10"
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <div className="flex flex-col gap-2">
        <h2 id="talent-form-title" className="text-3xl font-semibold tracking-title">
          {t("title")}
        </h2>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>

      <Field>
        <FieldLabel htmlFor="talent-photo">
          {t("photo.label")}
          {optional}
        </FieldLabel>
        <TalentPhotoUpload name={text.name} value={photo} onChange={setPhoto} />
      </Field>

      <h3 className={group}>{t("sections.basics")}</h3>
      <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
        <Field data-invalid={bad("name")}>
          <FieldLabel htmlFor="talent-name">
            {t("name")}
            <RequiredMark />
          </FieldLabel>
          <Input
            id="talent-name"
            autoComplete="name"
            maxLength={120}
            value={text.name}
            onChange={write("name")}
            aria-required
            aria-invalid={bad("name")}
            aria-describedby={bad("name") && "talent-name-error"}
          />
          {bad("name") && <FieldError id="talent-name-error">{t("nameRequired")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="talent-works-at">
            {t("worksAt")}
            {optional}
          </FieldLabel>
          <Input
            id="talent-works-at"
            autoComplete="organization"
            maxLength={120}
            value={text.worksAt}
            onChange={write("worksAt")}
          />
        </Field>
      </div>
      <Field data-invalid={bad("headline")}>
        <FieldLabel htmlFor="talent-headline">
          {t("headline")}
          <RequiredMark />
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
      <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="talent-country">
            {t("country")}
            {optional}
          </FieldLabel>
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
          <FieldLabel htmlFor="talent-city">
            {t("city")}
            {optional}
          </FieldLabel>
          <Input
            id="talent-city"
            autoComplete="address-level2"
            maxLength={80}
            value={text.city}
            onChange={write("city")}
          />
        </Field>
      </div>
      <Field data-invalid={bad("roles")}>
        <FieldLabel>
          {t("roles")}
          <RequiredMark />
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

      <h3 className={group}>{t("sections.skills")}</h3>
      <Field data-invalid={bad("skills")}>
        <FieldLabel htmlFor="talent-skills">
          {t("skills")}
          <RequiredMark />
        </FieldLabel>
        <TagInput
          id="talent-skills"
          aria-describedby={about("talent-skills")}
          aria-required
          aria-invalid={bad("skills")}
          value={chosen.skills}
          onValueChange={choose("skills")}
          max={MAX_SKILLS}
          maxLength={MAX_SKILL_LENGTH}
          placeholder={t("skillsPlaceholder")}
          removeLabel={(skill) => t("remove", { label: skill })}
          addLabel={t("add")}
          suggestions={suggestedSkills}
          suggestionsLabel={t("skillsSuggested")}
          suggestLabel={(skill) => t("addOne", { label: skill })}
        />
        {needed("skills")}
        <FieldDescription id="talent-skills-hint">
          {t("skillsHint", { count: MAX_SKILLS, chosen: chosen.skills.length })}
        </FieldDescription>
      </Field>
      <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
        <Field>
          <FieldLabel>
            {t("engagement")}
            {optional}
          </FieldLabel>
          <ChoiceChips
            label={t("engagement")}
            options={engagements.map((value) => ({ value, label: engagement(value) }))}
            value={chosen.engagement}
            onValueChange={choose("engagement")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="talent-rate">
            {t("rate")}
            {optional}
          </FieldLabel>
          <NativeSelect
            id="talent-rate"
            className="w-full"
            aria-describedby="talent-rate-hint"
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
          <FieldDescription id="talent-rate-hint">{t("rateHint")}</FieldDescription>
        </Field>
      </div>
      <Field data-invalid={bad("bio")}>
        <FieldLabel htmlFor="talent-bio">
          {t("bio")}
          <RequiredMark />
        </FieldLabel>
        <Textarea
          id="talent-bio"
          aria-describedby="talent-bio-error"
          rows={5}
          maxLength={MAX_BIO}
          value={text.bio}
          onChange={write("bio")}
          aria-required
          aria-invalid={bad("bio")}
        />
        {needed("bio")}
        <span className="text-right text-xs text-muted-foreground tabular-nums">
          {text.bio.length} / {MAX_BIO}
        </span>
      </Field>
      <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="talent-industries">
            {t("industries")}
            {optional}
          </FieldLabel>
          <ChoiceCombobox
            id="talent-industries"
            label={t("industries")}
            aria-describedby="talent-industries-hint"
            options={industries.map((value) => ({ value, label: industry(value) }))}
            value={chosen.industries}
            onValueChange={choose("industries")}
            max={MAX_INDUSTRIES}
            placeholder={t("searchPlaceholder")}
            emptyLabel={t("noMatch")}
            removeLabel={(label) => t("remove", { label })}
          />
          <FieldDescription id="talent-industries-hint">
            {t("upTo", { count: MAX_INDUSTRIES, chosen: chosen.industries.length })}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="talent-languages">
            {t("languages")}
            {optional}
          </FieldLabel>
          <ChoiceCombobox
            id="talent-languages"
            label={t("languages")}
            aria-describedby="talent-languages-hint"
            options={languageCodes.map((value) => ({ value, label: language(value) }))}
            value={chosen.languages}
            onValueChange={choose("languages")}
            max={MAX_LANGUAGES}
            placeholder={t("searchPlaceholder")}
            emptyLabel={t("noMatch")}
            removeLabel={(label) => t("remove", { label })}
          />
          <FieldDescription id="talent-languages-hint">
            {t("upTo", { count: MAX_LANGUAGES, chosen: chosen.languages.length })}
          </FieldDescription>
        </Field>
      </div>

      <div className="flex flex-col gap-2 border-t pt-6">
        <h3 className="text-lg font-semibold">
          {t("projects.title")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("projects.lead", { count: MAX_PROJECTS })}
        </p>
        {bad("projects") && <FieldError>{t("projects.titleRequired")}</FieldError>}
      </div>
      {projects.length > 0 && (
        <ul id="talent-projects" className="flex flex-col gap-4">
          {projects.map((project, index) => (
            <li key={project.key} className="flex flex-col gap-4 rounded-2xl border p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-4">
                  <Field
                    className="sm:col-span-3"
                    data-invalid={bad("projects") && !project.title.trim()}
                  >
                    <FieldLabel htmlFor={`project-title-${project.key}`}>
                      {t("projects.name", { number: index + 1 })}
                      <RequiredMark />
                    </FieldLabel>
                    <Input
                      id={`project-title-${project.key}`}
                      maxLength={120}
                      value={project.title}
                      aria-invalid={(bad("projects") && !project.title.trim()) || undefined}
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
                  className="mt-6"
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`project-stage-${project.key}`}>
                    {t("projects.stage")}
                  </FieldLabel>
                  <NativeSelect
                    id={`project-stage-${project.key}`}
                    className="w-full"
                    value={project.stage}
                    onChange={(event) => changeProject(project.key, "stage", event.target.value)}
                  >
                    <NativeSelectOption value="">{t("projects.stageNone")}</NativeSelectOption>
                    {projectStages.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {stage(value)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`project-url-${project.key}`}>
                    {t("projects.url")}
                  </FieldLabel>
                  <Input
                    id={`project-url-${project.key}`}
                    type="url"
                    inputMode="url"
                    maxLength={300}
                    value={project.url}
                    onChange={(event) => changeProject(project.key, "url", event.target.value)}
                    aria-describedby={`project-url-${project.key}-hint`}
                  />
                  <FieldDescription id={`project-url-${project.key}-hint`}>
                    {t("urlHint")}
                  </FieldDescription>
                </Field>
              </div>
            </li>
          ))}
        </ul>
      )}
      {projects.length < MAX_PROJECTS && (
        <Button prominence="secondary" className="self-start" onClick={addProject}>
          <PlusIcon aria-hidden="true" />
          {t("projects.add")}
        </Button>
      )}

      <h3 className={group}>{t("sections.links")}</h3>
      <Field data-invalid={bad("website")}>
        <FieldLabel htmlFor="talent-website">
          {t("website")}
          {optional}
        </FieldLabel>
        <Input
          id="talent-website"
          type="url"
          inputMode="url"
          autoComplete="url"
          maxLength={300}
          value={text.website}
          onChange={write("website")}
          aria-invalid={bad("website")}
          aria-describedby={about("talent-website")}
        />
        {/* A refused address replaces the hint: the two say the same. */}
        {bad("website") ? (
          <FieldError id="talent-website-error">{t("websiteInvalid")}</FieldError>
        ) : (
          <FieldDescription id="talent-website-hint">{t("urlHint")}</FieldDescription>
        )}
      </Field>

      <h3 id="talent-visibility" className={group}>
        {t("sections.visibility")}
      </h3>
      <RadioGroup
        aria-labelledby="talent-visibility"
        value={listed ? "listed" : "hidden"}
        onValueChange={(value) => setListed(value === "listed")}
        className="sm:grid-cols-2"
      >
        {(
          [
            ["listed", GlobeIcon],
            ["hidden", EyeOffIcon],
          ] as const
        ).map(([choice, Icon]) => (
          <FieldLabel key={choice} htmlFor={`talent-${choice}`}>
            <Field orientation="horizontal" className="items-start">
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <FieldContent>
                <FieldTitle>{t(`visibility.${choice}.title`)}</FieldTitle>
                <FieldDescription>{t(`visibility.${choice}.lead`)}</FieldDescription>
              </FieldContent>
              <RadioGroupItem value={choice} id={`talent-${choice}`} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>

      {submittable && (
        <ReviewReadiness
          missingTitle={t("readiness.missing")}
          readyTitle={t("readiness.ready")}
          note={t("readiness.note")}
          missing={toAdd}
          refused={invalid.has("name") || reviewFields.some((entry) => invalid.has(entry.field))}
        />
      )}

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap items-center gap-3 rounded-b-3xl border-t bg-card px-5 py-4 md:-mx-10 md:-mb-10 md:px-10 md:py-6">
        {submittable && (
          <Button
            type="submit"
            prominence="tertiary"
            size="lg"
            pending={pending === "save"}
            disabled={pending !== null || !dirty}
          >
            {t("saveDraft")}
          </Button>
        )}
        {dirty && <span className="text-sm text-muted-foreground">{t("unsaved")}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {submittable && toAdd.length > 0 && (
            <TextButton className="max-sm:hidden" onClick={() => focusField(toAdd[0].id)}>
              {t("readiness.count", { count: toAdd.length })}
            </TextButton>
          )}
          {submittable ? (
            <Button
              size="lg"
              pending={pending === "submit"}
              disabled={pending !== null}
              onClick={() => save(true)}
            >
              {t(returned ? "resubmit" : "submit")}
            </Button>
          ) : (
            <Button
              type="submit"
              size="lg"
              pending={pending === "save"}
              disabled={pending !== null || !dirty}
            >
              {t("save")}
            </Button>
          )}
        </div>
      </div>
      <LeaveGuard
        active={dirty}
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
    </form>
  );
}

export { TalentForm };
