"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { EyeOffIcon, GlobeIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { IconButton } from "@/components/actions/icon-button";
import { ChoiceChips } from "@/components/composites/choice-chips";
import { ChoiceCombobox } from "@/components/composites/choice-combobox";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { RequiredMark } from "@/components/composites/required-mark";
import { ReviewReadiness } from "@/components/composites/review-readiness";
import { TagInput } from "@/components/composites/tag-input";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { fieldIdOf } from "@/components/form/field-ids";
import { useFieldValidity } from "@/components/form/form-context";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  saveMyTalentProfile,
  submitMyTalentProfile,
  type TalentProfile,
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
  talentSections,
} from "./talent-codes";
import { TalentPhotoUpload } from "./talent-photo-upload";
import {
  blankProject,
  missingForReview,
  reviewFields,
  talentBodyOf,
  talentLimits,
  talentSchema,
  talentValuesOf,
} from "./talent-schemas";

type TalentFormProps = {
  /** The caller's profile; without one the first save creates it. */
  profile: TalentProfile | null;
  /** The name to start a new profile with, from the caller's account. */
  suggestedName: string;
  /** What the side column shows above who can see the profile, such as where it stands. */
  aside?: ReactNode;
};

/** What a control needs to be tied to its field: its id, what describes it and whether it is refused. */
type Control = { id: string; describedBy: string | undefined; invalid: true | undefined };

type ControlFieldProps = {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  /** False for a group of controls, which a label cannot point at; the group names itself. */
  labelled?: boolean;
  children: (control: Control) => ReactNode;
};

/**
 * A field of the form whose control the shared set lacks, such as chips, a combobox, tags or a
 * native select: its label, the control, its hint and what is wrong with it.
 */
function ControlField({
  label,
  required,
  optional,
  hint,
  labelled = true,
  children,
}: ControlFieldProps) {
  const t = useTranslations("Form");
  const { invalid, errors, ids } = useFieldValidity<unknown>();
  const { control: controlId, hint: hintId, error: errorId } = ids;
  const describedBy =
    [hint ? hintId : undefined, invalid ? errorId : undefined].filter(Boolean).join(" ") ||
    undefined;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={labelled ? controlId : undefined}>
        {label}
        {required && <RequiredMark />}
        {optional && <span className="font-normal text-muted-foreground">{t("optional")}</span>}
      </FieldLabel>
      {children({ id: controlId, describedBy, invalid: invalid || undefined })}
      {hint && <FieldDescription id={hintId}>{hint}</FieldDescription>}
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
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
function TalentForm({ profile, suggestedName, aside }: TalentFormProps) {
  const t = useTranslations("Talent.form");
  const say = useTranslations("Form");
  const role = useVocabulary("talentRole");
  const engagement = useVocabulary("engagement");
  const rateBand = useVocabulary("rateBand");
  const countryName = useCountryName();
  const language = useVocabulary("language");
  const industry = useVocabulary("industry");
  const stage = useVocabulary("projectStage");
  const notify = useNotify();
  const router = useRouter();
  // Which action is on its way, and whether the last one asked for a review: the form then keeps
  // asking for what a review needs while the person corrects it.
  const [sending, setSending] = useState<"save" | "submit" | null>(null);
  const forReview = useRef(false);

  // Sent back, or taken down after approval: either way the person corrects it and sends it again.
  const returned =
    profile?.status === "needs_changes" ||
    (profile?.status === "approved" && Boolean(profile.suspendedAt));
  const submittable = !profile || profile.status === "draft" || returned;

  const form = useAppForm({
    defaultValues: talentValuesOf(profile, suggestedName),
    validationLogic: revalidateLogic(),
    validators: {
      // A profile that is under review or published keeps what a review needs.
      onDynamic: ({ formApi }) =>
        formApi.parseValuesWithSchema(talentSchema(t, forReview.current || !submittable)),
    },
    onSubmitInvalid: ({ formApi }) => {
      const saveable = talentSchema(t, false).safeParse(formApi.state.values).success;
      notify.error(saveable ? "Errors.TALENT_INCOMPLETE" : "Errors.REQUEST_INVALID");
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await saveMyTalentProfile({ body: talentBodyOf(value, profile?.version ?? null) });
        if (forReview.current) {
          await submitMyTalentProfile();
        }
        notify.success(forReview.current ? "Talent.done.submitted" : "Talent.done.saved");
        router.refresh();
      } catch (error) {
        const rejected = rejectedFields(error);
        const fields: Record<string, { message: string }> = {};
        if (rejected.has("name")) {
          fields.name = { message: t("nameRequired") };
        }
        if (rejected.has("website")) {
          fields.website = { message: t("websiteInvalid") };
        }
        for (const field of reviewFields) {
          if (rejected.has(field)) {
            fields[field] = { message: t(`needed.${field}`) };
          }
        }
        if (rejected.has("projects")) {
          value.projects.forEach((project, index) => {
            if (!project.title.trim()) {
              fields[`projects[${index}].title`] = { message: t("projects.titleRequired") };
            }
          });
        }
        setServerErrors(formApi, { fields });
        notify.failure(error);
        // The save may have gone through before the submission was refused; the page shows which.
        router.refresh();
      }
    },
  });

  /** Saves the form, and sends it for review too when that is asked. */
  async function send(review: boolean) {
    forReview.current = review;
    setSending(review ? "submit" : "save");
    await form.handleSubmit();
    setSending(null);
  }

  const values = useStore(form.store, (state) => state.values);
  const dirty = useStore(form.store, (state) => !state.isDefaultValue) && sending === null;
  // A refused attempt left a field the review needs marked.
  const refused = useStore(form.store, (state) =>
    (["name", ...reviewFields] as const).some(
      (field) => (state.fieldMeta[field]?.errors.length ?? 0) > 0,
    ),
  );
  /** What is still to add before a review, in the order of the form; each id is its field's. */
  const toAdd = [
    ...(values.name.trim() ? [] : [{ id: fieldIdOf(form, "name"), label: t("name") }]),
    ...missingForReview(values).map((field) => ({ id: fieldIdOf(form, field), label: t(field) })),
  ];
  const group = "scroll-mt-24 border-t pt-6 text-lg font-semibold";

  return (
    <form
      id={form.formId}
      noValidate
      aria-labelledby="talent-form-title"
      className="flex flex-col gap-6 lg:flex-row lg:items-start xl:gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        void send(false);
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-7 rounded-3xl border bg-card p-5 md:p-10">
        <div id={talentSections.profile} className="flex scroll-mt-24 flex-col gap-2">
          <h2 id="talent-form-title" className="text-3xl font-semibold tracking-title">
            {t("title")}
          </h2>
          <p className="text-muted-foreground">{t("lead")}</p>
        </div>

        <form.Field name="photoFileId">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="talent-photo">
                {t("photo.label")}
                <span className="font-normal text-muted-foreground">{say("optional")}</span>
              </FieldLabel>
              <TalentPhotoUpload
                name={values.name}
                value={field.state.value}
                onChange={field.handleChange}
              />
            </Field>
          )}
        </form.Field>

        <h3 id={talentSections.basics} className={group}>
          {t("sections.basics")}
        </h3>
        <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t("name")}
                requiredMark
                autoComplete="name"
                maxLength={120}
                aria-required
              />
            )}
          </form.AppField>
          <form.AppField name="worksAt">
            {(field) => (
              <field.TextField
                label={t("worksAt")}
                optional
                autoComplete="organization"
                maxLength={120}
              />
            )}
          </form.AppField>
        </div>
        <form.AppField name="headline">
          {(field) => (
            <field.TextField
              label={t("headline")}
              requiredMark
              maxLength={160}
              aria-required
              description={t("headlineHint")}
            />
          )}
        </form.AppField>
        <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
          <form.AppField name="country">
            {(field) => (
              <ControlField label={t("country")} optional>
                {(control) => (
                  <NativeSelect
                    id={control.id}
                    className="w-full"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  >
                    <NativeSelectOption value="">{t("notStated")}</NativeSelectOption>
                    {countryCodes.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {countryName(value)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </ControlField>
            )}
          </form.AppField>
          <form.AppField name="city">
            {(field) => (
              <field.TextField
                label={t("city")}
                optional
                autoComplete="address-level2"
                maxLength={80}
              />
            )}
          </form.AppField>
        </div>
        <form.AppField name="roles">
          {(field) => (
            <ControlField
              label={t("roles")}
              required
              labelled={false}
              hint={t("upTo", { count: talentLimits.roles, chosen: field.state.value.length })}
            >
              {(control) => (
                <ChoiceChips
                  id={control.id}
                  aria-describedby={control.describedBy}
                  aria-invalid={control.invalid}
                  label={t("roles")}
                  options={talentRoles.map((value) => ({ value, label: role(value) }))}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  max={talentLimits.roles}
                />
              )}
            </ControlField>
          )}
        </form.AppField>

        <h3 id={talentSections.skills} className={group}>
          {t("sections.skills")}
        </h3>
        <form.AppField name="skills">
          {(field) => (
            <ControlField
              label={t("skills")}
              required
              hint={t("skillsHint", {
                count: talentLimits.skills,
                chosen: field.state.value.length,
              })}
            >
              {(control) => (
                <TagInput
                  id={control.id}
                  aria-describedby={control.describedBy}
                  aria-required
                  aria-invalid={control.invalid}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  max={talentLimits.skills}
                  maxLength={talentLimits.skillLength}
                  placeholder={t("skillsPlaceholder")}
                  removeLabel={(skill) => t("remove", { label: skill })}
                  addLabel={t("add")}
                  suggestions={suggestedSkills}
                  suggestionsLabel={t("skillsSuggested")}
                  suggestLabel={(skill) => t("addOne", { label: skill })}
                />
              )}
            </ControlField>
          )}
        </form.AppField>
        <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
          <form.AppField name="engagement">
            {(field) => (
              <ControlField label={t("engagement")} optional labelled={false}>
                {(control) => (
                  <ChoiceChips
                    id={control.id}
                    aria-describedby={control.describedBy}
                    aria-invalid={control.invalid}
                    label={t("engagement")}
                    options={engagements.map((value) => ({ value, label: engagement(value) }))}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  />
                )}
              </ControlField>
            )}
          </form.AppField>
          <form.AppField name="rateBand">
            {(field) => (
              <ControlField label={t("rate")} optional hint={t("rateHint")}>
                {(control) => (
                  <NativeSelect
                    id={control.id}
                    className="w-full"
                    aria-describedby={control.describedBy}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  >
                    <NativeSelectOption value="">{t("notStated")}</NativeSelectOption>
                    {rateBands.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {rateBand(value)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </ControlField>
            )}
          </form.AppField>
        </div>
        <form.AppField name="bio">
          {(field) => (
            <field.TextareaField
              label={t("bio")}
              requiredMark
              rows={5}
              maxLength={talentLimits.bio}
              aria-required
            />
          )}
        </form.AppField>
        <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
          <form.AppField name="industries">
            {(field) => (
              <ControlField
                label={t("industries")}
                optional
                hint={t("upTo", {
                  count: talentLimits.industries,
                  chosen: field.state.value.length,
                })}
              >
                {(control) => (
                  <ChoiceCombobox
                    id={control.id}
                    label={t("industries")}
                    aria-describedby={control.describedBy}
                    options={industries.map((value) => ({ value, label: industry(value) }))}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    max={talentLimits.industries}
                    placeholder={t("searchPlaceholder")}
                    emptyLabel={t("noMatch")}
                    removeLabel={(label) => t("remove", { label })}
                  />
                )}
              </ControlField>
            )}
          </form.AppField>
          <form.AppField name="languages">
            {(field) => (
              <ControlField
                label={t("languages")}
                optional
                hint={t("upTo", {
                  count: talentLimits.languages,
                  chosen: field.state.value.length,
                })}
              >
                {(control) => (
                  <ChoiceCombobox
                    id={control.id}
                    label={t("languages")}
                    aria-describedby={control.describedBy}
                    options={languageCodes.map((value) => ({ value, label: language(value) }))}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    max={talentLimits.languages}
                    placeholder={t("searchPlaceholder")}
                    emptyLabel={t("noMatch")}
                    removeLabel={(label) => t("remove", { label })}
                  />
                )}
              </ControlField>
            )}
          </form.AppField>
        </div>

        <div
          id={talentSections.projects}
          className="flex scroll-mt-24 flex-col gap-2 border-t pt-6"
        >
          <h3 className="text-lg font-semibold">
            {t("projects.title")}{" "}
            <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("projects.lead", { count: talentLimits.projects })}
          </p>
        </div>
        <form.Field name="projects" mode="array">
          {(list) => (
            <>
              {list.state.value.length > 0 && (
                <ul className="flex flex-col gap-4">
                  {list.state.value.map((_, index) => (
                    <li key={index} className="flex flex-col gap-4 rounded-2xl border p-4 md:p-5">
                      <div className="flex items-start gap-3">
                        <div className="grid flex-1 gap-3 sm:grid-cols-4">
                          <div className="sm:col-span-3">
                            <form.AppField name={`projects[${index}].title`}>
                              {(field) => (
                                <field.TextField
                                  label={t("projects.name", { number: index + 1 })}
                                  requiredMark
                                  maxLength={120}
                                />
                              )}
                            </form.AppField>
                          </div>
                          <form.AppField name={`projects[${index}].year`}>
                            {(field) => (
                              <field.TextField
                                label={t("projects.year")}
                                type="number"
                                inputMode="numeric"
                                min={1990}
                                max={2100}
                              />
                            )}
                          </form.AppField>
                        </div>
                        <IconButton
                          className="mt-6"
                          aria-label={t("projects.remove", { number: index + 1 })}
                          onClick={() => list.removeValue(index)}
                        >
                          <Trash2Icon aria-hidden="true" />
                        </IconButton>
                      </div>
                      <form.AppField name={`projects[${index}].summary`}>
                        {(field) => (
                          <field.TextareaField
                            label={t("projects.summary")}
                            rows={2}
                            maxLength={600}
                          />
                        )}
                      </form.AppField>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <form.AppField name={`projects[${index}].stage`}>
                          {(field) => (
                            <ControlField label={t("projects.stage")}>
                              {(control) => (
                                <NativeSelect
                                  id={control.id}
                                  className="w-full"
                                  value={field.state.value}
                                  onChange={(event) => field.handleChange(event.target.value)}
                                >
                                  <NativeSelectOption value="">
                                    {t("projects.stageNone")}
                                  </NativeSelectOption>
                                  {projectStages.map((value) => (
                                    <NativeSelectOption key={value} value={value}>
                                      {stage(value)}
                                    </NativeSelectOption>
                                  ))}
                                </NativeSelect>
                              )}
                            </ControlField>
                          )}
                        </form.AppField>
                        <form.AppField name={`projects[${index}].url`}>
                          {(field) => (
                            <field.TextField
                              label={t("projects.url")}
                              type="url"
                              inputMode="url"
                              maxLength={300}
                              description={t("urlHint")}
                            />
                          )}
                        </form.AppField>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {list.state.value.length < talentLimits.projects && (
                <Button
                  prominence="secondary"
                  className="self-start"
                  onClick={() => {
                    const added = list.state.value.length;
                    list.pushValue(blankProject);
                    // The new row takes the focus once it is drawn.
                    requestAnimationFrame(() =>
                      focusField(fieldIdOf(form, `projects[${added}].title`)),
                    );
                  }}
                >
                  <PlusIcon aria-hidden="true" />
                  {t("projects.add")}
                </Button>
              )}
            </>
          )}
        </form.Field>

        <h3 id={talentSections.links} className={group}>
          {t("sections.links")}
        </h3>
        <form.AppField name="website">
          {(field) => (
            <field.TextField
              label={t("website")}
              optional
              type="url"
              inputMode="url"
              autoComplete="url"
              maxLength={300}
              description={t("urlHint")}
            />
          )}
        </form.AppField>
      </div>

      <div className="flex min-w-0 flex-col gap-4 max-lg:contents lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
        {aside}
        <section
          aria-labelledby="talent-visibility"
          className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border bg-card p-5"
        >
          <h3 id={talentSections.visibility} className="text-lg font-semibold">
            {t("sections.visibility")}
          </h3>
          <form.Field name="listed">
            {(field) => (
              <RadioGroup
                aria-labelledby="talent-visibility"
                value={field.state.value ? "listed" : "hidden"}
                onValueChange={(value) => field.handleChange(value === "listed")}
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
            )}
          </form.Field>
        </section>

        <div className="sticky bottom-0 z-10 flex flex-col gap-4 rounded-2xl border bg-card p-5 lg:static">
          {submittable && (
            <ReviewReadiness
              missingTitle={t("readiness.missing")}
              readyTitle={t("readiness.ready")}
              note={t("readiness.note")}
              missing={toAdd}
              refused={refused}
            />
          )}

          <div className="flex flex-wrap items-center gap-3">
            {submittable && (
              <Button
                type="submit"
                prominence="tertiary"
                size="lg"
                pending={sending === "save"}
                disabled={sending !== null || !dirty}
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
                  pending={sending === "submit"}
                  disabled={sending !== null}
                  onClick={() => send(true)}
                >
                  {t(returned ? "resubmit" : "submit")}
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  pending={sending === "save"}
                  disabled={sending !== null || !dirty}
                >
                  {t("save")}
                </Button>
              )}
            </div>
          </div>
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
