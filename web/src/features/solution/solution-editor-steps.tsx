"use client";

import {
  CirclePlayIcon,
  FileTextIcon,
  ImageIcon,
  ImagesIcon,
  LinkIcon,
  PanelTopIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { ChoiceChips } from "@/components/composites/choice-chips";
import { ChoiceSelect } from "@/components/composites/choice-select";
import { RequiredMark } from "@/components/composites/required-mark";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useVocabulary } from "@/i18n/vocabulary";
import type { CustomerDeployment } from "@/lib/api/generated";

import { CodeCombobox } from "./code-combobox";
import { CustomerDeploymentsEditor } from "./customer-deployments-editor";
import { DeckUpload } from "./deck-upload";
import { GalleryUpload, ImageUpload } from "./image-upload";
import { OfferPicker } from "./offer-picker";
import { deployments, focusAreas, industries, languages, maturities } from "./solution-codes";
import type { SolutionForm } from "./solution-editor-form";
import {
  fieldId,
  limits,
  reviewFields,
  type HeldImage,
  type LinkField,
  type SolutionDraft,
} from "./solution-editor-state";
import { TagInput } from "./tag-input";

type StepProps = {
  /** The editor's form, which holds the draft; each field of a step is one of its fields. */
  form: SolutionForm;
  /** What is wrong with a field, in words, when something is to be shown under it. */
  errorOf: (field: keyof SolutionDraft) => string | undefined;
};

type EditorFieldProps = {
  field: keyof SolutionDraft;
  label: string;
  /** What kind of thing the field holds, before its label; the label says the same in words. */
  icon?: React.ReactNode;
  /** The word "Optional", for a field a review does not need. */
  optional?: string;
  hint?: string;
  /** How much of the field's length is used: "158 / 600". */
  counter?: string;
  error?: string;
  /** False for a group of controls, which a label cannot point at; it then names the group. */
  labelled?: boolean;
  children: React.ReactNode;
};

/** One field of the editor: its label, its control, then what is wrong with it or what it is for. */
function EditorField({
  field,
  label,
  icon,
  optional,
  hint,
  counter,
  error,
  labelled = true,
  children,
}: EditorFieldProps) {
  const id = fieldId(field);
  // What a review needs is what the editor asks for, so the asterisk follows that list.
  const required = reviewFields.some((entry) => entry.field === field);

  return (
    <Field
      data-invalid={error ? true : undefined}
      aria-labelledby={labelled ? undefined : `${id}-label`}
    >
      <FieldLabel htmlFor={labelled ? id : undefined} id={`${id}-label`}>
        {icon && <span className="shrink-0 [&_svg]:size-4">{icon}</span>}
        {label}
        {required && <RequiredMark />}
        {optional && <span className="font-normal text-muted-foreground">{optional}</span>}
      </FieldLabel>
      {children}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      {(hint || counter) && (
        <div className="flex items-start justify-between gap-3">
          {hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
          {counter && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
              {counter}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}

/** The ids of what describes a field's control: its hint and its error, whichever are drawn. */
function about(field: keyof SolutionDraft, error: string | undefined, hint: boolean) {
  const id = fieldId(field);
  return [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
}

type BasicsStepProps = StepProps & {
  solutionId: string;
  /** True for an operator, whose new offer joins GenAI Fund's list; a member's is their organization's. */
  operator: boolean;
};

/** Step 1: what the solution is, how far it has come, what it is built with and what it comes with. */
function BasicsStep({ form, errorOf, solutionId, operator }: BasicsStepProps) {
  const t = useTranslations("Solution.editor");
  const maturity = useVocabulary("maturity");

  return (
    <>
      <form.Field name="solution.name">
        {(field) => (
          <EditorField field="name" label={t("fields.name")} error={errorOf("name")}>
            <Input
              id={fieldId("name")}
              maxLength={limits.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-required
              aria-invalid={errorOf("name") ? true : undefined}
              aria-describedby={about("name", errorOf("name"), false)}
            />
          </EditorField>
        )}
      </form.Field>
      <form.Field name="solution.summary">
        {(field) => (
          <EditorField
            field="summary"
            label={t("fields.summary")}
            hint={t("fields.summaryHint")}
            counter={t("counter", { count: field.state.value.length, max: limits.summary })}
            error={errorOf("summary")}
          >
            <Textarea
              id={fieldId("summary")}
              rows={3}
              maxLength={limits.summary}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-required
              aria-invalid={errorOf("summary") ? true : undefined}
              aria-describedby={about("summary", errorOf("summary"), true)}
            />
          </EditorField>
        )}
      </form.Field>
      <form.AppField name="solution.problemsSolved">
        {(field) => (
          <field.TextareaField
            label={t("fields.problemsSolved")}
            optional
            rows={4}
            maxLength={limits.longAnswer}
            description={t("fields.problemsSolvedHint")}
          />
        )}
      </form.AppField>
      <form.AppField name="solution.valueProposition">
        {(field) => (
          <field.TextareaField
            label={t("fields.valueProposition")}
            optional
            rows={4}
            maxLength={limits.longAnswer}
            description={t("fields.valuePropositionHint")}
          />
        )}
      </form.AppField>
      <form.Field name="solution.maturity">
        {(field) => (
          <EditorField field="maturity" label={t("fields.maturity")} error={errorOf("maturity")}>
            <ChoiceSelect
              id={fieldId("maturity")}
              options={maturities.map((value) => ({ value, label: maturity(value) }))}
              value={field.state.value}
              onValueChange={field.handleChange}
              placeholder={t("fields.maturityPlaceholder")}
              aria-required
              aria-invalid={errorOf("maturity") ? true : undefined}
              aria-describedby={about("maturity", errorOf("maturity"), false)}
            />
          </EditorField>
        )}
      </form.Field>
      <form.AppField name="solution.traction">
        {(field) => (
          <field.TextareaField
            label={t("fields.traction")}
            optional
            rows={3}
            maxLength={limits.traction}
            description={t("fields.tractionHint")}
          />
        )}
      </form.AppField>
      <form.Field name="solution.builtWith">
        {(field) => (
          <EditorField
            field="builtWith"
            label={t("fields.builtWith")}
            optional={t("optional")}
            hint={t("fields.builtWithHint", { max: limits.builtWith })}
          >
            <TagInput
              id={fieldId("builtWith")}
              value={field.state.value}
              onValueChange={field.handleChange}
              placeholder={t("fields.builtWithPlaceholder")}
              max={limits.builtWith}
              maxLength={limits.builtWithName}
              removeLabel={(name) => t("fields.removeTag", { name })}
              aria-describedby={about("builtWith", undefined, true)}
            />
          </EditorField>
        )}
      </form.Field>
      <form.Field name="solution.offers">
        {(field) => (
          <EditorField
            field="offers"
            label={t("fields.offers")}
            optional={t("optional")}
            hint={t("fields.offersHint", { max: limits.offers })}
          >
            <OfferPicker
              id={fieldId("offers")}
              solutionId={solutionId}
              value={field.state.value}
              onValueChange={field.handleChange}
              operator={operator}
              aria-describedby={about("offers", undefined, true)}
            />
          </EditorField>
        )}
      </form.Field>
    </>
  );
}

/** Step 2: who should find the solution and where it can run. */
function FitStep({ form, errorOf }: StepProps) {
  const t = useTranslations("Solution.editor");
  const industry = useVocabulary("industry");
  const focusArea = useVocabulary("focusArea");
  const language = useVocabulary("language");
  const deployment = useVocabulary("deployment");

  return (
    <>
      <form.Field name="solution.industries">
        {(field) => (
          <EditorField
            field="industries"
            label={t("fields.industries")}
            hint={t("fields.upTo", { max: limits.choices, chosen: field.state.value.length })}
            error={errorOf("industries")}
          >
            <CodeCombobox
              id={fieldId("industries")}
              options={industries.map((value) => ({ value, label: industry(value) }))}
              value={field.state.value}
              onValueChange={field.handleChange}
              placeholder={t("fields.industriesPlaceholder")}
              emptyLabel={t("fields.noMatch")}
              removeLabel={(name) => t("fields.removeTag", { name })}
              max={limits.choices}
              invalid={errorOf("industries") !== undefined}
              aria-describedby={about("industries", errorOf("industries"), true)}
            />
          </EditorField>
        )}
      </form.Field>
      <form.Field name="solution.focusAreas">
        {(field) => (
          <EditorField
            field="focusAreas"
            label={t("fields.focusAreas")}
            hint={t("fields.upTo", { max: limits.choices, chosen: field.state.value.length })}
            error={errorOf("focusAreas")}
          >
            <CodeCombobox
              id={fieldId("focusAreas")}
              options={focusAreas.map((value) => ({ value, label: focusArea(value) }))}
              value={field.state.value}
              onValueChange={field.handleChange}
              placeholder={t("fields.focusAreasPlaceholder")}
              emptyLabel={t("fields.noMatch")}
              removeLabel={(name) => t("fields.removeTag", { name })}
              max={limits.choices}
              invalid={errorOf("focusAreas") !== undefined}
              aria-describedby={about("focusAreas", errorOf("focusAreas"), true)}
            />
          </EditorField>
        )}
      </form.Field>
      <form.Field name="solution.languages">
        {(field) => (
          <EditorField field="languages" label={t("fields.languages")} optional={t("optional")}>
            <CodeCombobox
              id={fieldId("languages")}
              options={languages.map((value) => ({ value, label: language(value) }))}
              value={field.state.value}
              onValueChange={field.handleChange}
              placeholder={t("fields.languagesPlaceholder")}
              emptyLabel={t("fields.noMatch")}
              removeLabel={(name) => t("fields.removeTag", { name })}
              max={limits.languages}
            />
          </EditorField>
        )}
      </form.Field>
      <form.Field name="solution.deployment">
        {(field) => (
          <EditorField
            field="deployment"
            label={t("fields.deployment")}
            optional={t("optional")}
            labelled={false}
          >
            <ChoiceChips
              id={fieldId("deployment")}
              label={t("fields.deployment")}
              options={deployments.map((value) => ({ value, label: deployment(value) }))}
              value={field.state.value}
              onValueChange={field.handleChange}
            />
          </EditorField>
        )}
      </form.Field>
      <form.AppField name="solution.channels">
        {(field) => (
          <field.TextField
            label={t("fields.channels")}
            optional
            maxLength={limits.channels}
            description={t("fields.channelsHint")}
          />
        )}
      </form.AppField>
      <form.AppField name="solution.bestCustomerProfile">
        {(field) => (
          <field.TextareaField
            label={t("fields.bestCustomerProfile")}
            optional
            rows={3}
            maxLength={limits.bestCustomerProfile}
            description={t("fields.bestCustomerProfileHint")}
          />
        )}
      </form.AppField>
    </>
  );
}

type EvidenceStepProps = StepProps & {
  solutionId: string;
  /** Where the deck is read, once the solution names the file the editor holds. */
  deckHref: string | undefined;
  /** True while the solution was never sent for review. */
  unsent: boolean;
  /** The projects customers put the solution to work in; null where an operator writes it, since the organization adds them. */
  customerDeployments: CustomerDeployment[] | null;
  /** An image under the cover finished uploading. */
  onImageAdded: (image: HeldImage) => void;
};

/**
 * Step 3: what the solution shows of itself, its logo, its cover and the images under it, then the
 * deck, a demo, the product's page and the projects customers put it to work in.
 */
function EvidenceStep({
  form,
  errorOf,
  solutionId,
  deckHref,
  unsent,
  customerDeployments,
  onImageAdded,
}: EvidenceStepProps) {
  const t = useTranslations("Solution.editor");
  // A link says what is wrong with it once it was left, which the form keeps as the field's blur.
  const link = (field: LinkField, hint: string, icon: React.ReactNode) => (
    <form.Field name={`solution.${field}`}>
      {(bound) => (
        <EditorField
          field={field}
          label={t(`fields.${field}`)}
          icon={icon}
          optional={t("optional")}
          hint={hint}
          error={errorOf(field)}
        >
          <Input
            id={fieldId(field)}
            type="url"
            inputMode="url"
            autoComplete="off"
            maxLength={limits.link}
            value={bound.state.value}
            onChange={(event) => bound.handleChange(event.target.value)}
            onBlur={bound.handleBlur}
            aria-invalid={errorOf(field) ? true : undefined}
            aria-describedby={about(field, errorOf(field), true)}
          />
        </EditorField>
      )}
    </form.Field>
  );
  const image = (place: "logo" | "cover", icon: React.ReactNode) => (
    <form.Field name={`solution.${place}`}>
      {(bound) => (
        <EditorField
          field={place}
          label={t(`fields.${place}`)}
          icon={icon}
          hint={t(`images.${place}.hint`)}
          error={errorOf(place)}
          labelled={false}
        >
          <ImageUpload
            id={fieldId(place)}
            place={place}
            image={bound.state.value}
            invalid={errorOf(place) !== undefined}
            describedBy={about(place, errorOf(place), true)}
            onChange={bound.handleChange}
          />
        </EditorField>
      )}
    </form.Field>
  );

  return (
    <>
      {image("logo", <ImageIcon aria-hidden="true" />)}
      {image("cover", <PanelTopIcon aria-hidden="true" />)}
      <form.Field name="solution.images">
        {(field) => (
          <EditorField
            field="images"
            label={t("fields.images")}
            icon={<ImagesIcon aria-hidden="true" />}
            optional={t("optional")}
            hint={t("images.more.hint")}
            labelled={false}
          >
            <GalleryUpload
              id={fieldId("images")}
              images={field.state.value}
              onAdd={onImageAdded}
              onChange={field.handleChange}
            />
          </EditorField>
        )}
      </form.Field>
      <form.Field name="solution.deck">
        {(field) => (
          <EditorField
            field="deck"
            label={t("fields.deck")}
            icon={<FileTextIcon aria-hidden="true" />}
            optional={t("optional")}
            labelled={false}
          >
            <DeckUpload
              id={fieldId("deck")}
              deck={field.state.value}
              href={deckHref}
              onChange={field.handleChange}
            />
          </EditorField>
        )}
      </form.Field>
      {link("demoUrl", t("fields.demoUrlHint"), <CirclePlayIcon aria-hidden="true" />)}
      {link("website", t("fields.websiteHint"), <LinkIcon aria-hidden="true" />)}
      {customerDeployments && (
        <CustomerDeploymentsEditor
          solutionId={solutionId}
          draft={unsent}
          deployments={customerDeployments}
        />
      )}
    </>
  );
}

export { BasicsStep, EvidenceStep, FitStep };
