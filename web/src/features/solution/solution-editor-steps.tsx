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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useVocabulary } from "@/i18n/vocabulary";
import type { CustomerDeployment } from "@/lib/api/generated";

import { CodeCombobox } from "./code-combobox";
import { CustomerDeploymentsEditor } from "./customer-deployments-editor";
import { DeckUpload } from "./deck-upload";
import { GalleryUpload, ImageUpload } from "./image-upload";
import { deployments, focusAreas, industries, languages, maturities } from "./solution-codes";
import {
  fieldId,
  limits,
  type HeldImage,
  type LinkField,
  type SolutionDraft,
} from "./solution-editor-state";
import { TagInput } from "./tag-input";

type StepProps = {
  draft: SolutionDraft;
  change: (patch: Partial<SolutionDraft>) => void;
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

  return (
    <Field
      data-invalid={error ? true : undefined}
      aria-labelledby={labelled ? undefined : `${id}-label`}
    >
      <FieldLabel htmlFor={labelled ? id : undefined} id={`${id}-label`}>
        {icon && <span className="shrink-0 [&_svg]:size-4">{icon}</span>}
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">{optional}</span>}
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

/** Step 1: what the solution is, how far it has come and what it is built with. */
function BasicsStep({ draft, change, errorOf }: StepProps) {
  const t = useTranslations("Solution.editor");
  const maturity = useVocabulary("maturity");
  const counter = (value: string, max: number) => t("counter", { count: value.length, max });

  return (
    <>
      <EditorField field="name" label={t("fields.name")} error={errorOf("name")}>
        <Input
          id={fieldId("name")}
          maxLength={limits.name}
          value={draft.name}
          onChange={(event) => change({ name: event.target.value })}
          aria-required
          aria-invalid={errorOf("name") ? true : undefined}
          aria-describedby={about("name", errorOf("name"), false)}
        />
      </EditorField>
      <EditorField
        field="summary"
        label={t("fields.summary")}
        hint={t("fields.summaryHint")}
        counter={counter(draft.summary, limits.summary)}
        error={errorOf("summary")}
      >
        <Textarea
          id={fieldId("summary")}
          rows={3}
          maxLength={limits.summary}
          value={draft.summary}
          onChange={(event) => change({ summary: event.target.value })}
          aria-required
          aria-invalid={errorOf("summary") ? true : undefined}
          aria-describedby={about("summary", errorOf("summary"), true)}
        />
      </EditorField>
      <EditorField
        field="problemsSolved"
        label={t("fields.problemsSolved")}
        optional={t("optional")}
        hint={t("fields.problemsSolvedHint")}
        counter={counter(draft.problemsSolved, limits.longAnswer)}
      >
        <Textarea
          id={fieldId("problemsSolved")}
          rows={4}
          maxLength={limits.longAnswer}
          value={draft.problemsSolved}
          onChange={(event) => change({ problemsSolved: event.target.value })}
          aria-describedby={about("problemsSolved", undefined, true)}
        />
      </EditorField>
      <EditorField
        field="valueProposition"
        label={t("fields.valueProposition")}
        optional={t("optional")}
        hint={t("fields.valuePropositionHint")}
        counter={counter(draft.valueProposition, limits.longAnswer)}
      >
        <Textarea
          id={fieldId("valueProposition")}
          rows={4}
          maxLength={limits.longAnswer}
          value={draft.valueProposition}
          onChange={(event) => change({ valueProposition: event.target.value })}
          aria-describedby={about("valueProposition", undefined, true)}
        />
      </EditorField>
      <EditorField field="maturity" label={t("fields.maturity")} error={errorOf("maturity")}>
        <NativeSelect
          id={fieldId("maturity")}
          className="w-full"
          value={draft.maturity}
          onChange={(event) => change({ maturity: event.target.value })}
          aria-required
          aria-invalid={errorOf("maturity") ? true : undefined}
          aria-describedby={about("maturity", errorOf("maturity"), false)}
        >
          <NativeSelectOption value="">{t("fields.maturityPlaceholder")}</NativeSelectOption>
          {maturities.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {maturity(value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </EditorField>
      <EditorField
        field="traction"
        label={t("fields.traction")}
        optional={t("optional")}
        counter={counter(draft.traction, limits.traction)}
      >
        <Textarea
          id={fieldId("traction")}
          rows={3}
          maxLength={limits.traction}
          placeholder={t("fields.tractionPlaceholder")}
          value={draft.traction}
          onChange={(event) => change({ traction: event.target.value })}
        />
      </EditorField>
      <EditorField
        field="builtWith"
        label={t("fields.builtWith")}
        optional={t("optional")}
        hint={t("fields.builtWithHint", { max: limits.builtWith })}
      >
        <TagInput
          id={fieldId("builtWith")}
          value={draft.builtWith}
          onValueChange={(builtWith) => change({ builtWith })}
          placeholder={t("fields.builtWithPlaceholder")}
          max={limits.builtWith}
          maxLength={limits.builtWithName}
          removeLabel={(name) => t("fields.removeTag", { name })}
          aria-describedby={about("builtWith", undefined, true)}
        />
      </EditorField>
    </>
  );
}

/** Step 2: who should find the solution and where it can run. */
function FitStep({ draft, change, errorOf }: StepProps) {
  const t = useTranslations("Solution.editor");
  const industry = useVocabulary("industry");
  const focusArea = useVocabulary("focusArea");
  const language = useVocabulary("language");
  const deployment = useVocabulary("deployment");

  return (
    <>
      <EditorField
        field="industries"
        label={t("fields.industries")}
        hint={t("fields.upTo", { max: limits.choices, chosen: draft.industries.length })}
        error={errorOf("industries")}
      >
        <CodeCombobox
          id={fieldId("industries")}
          options={industries.map((value) => ({ value, label: industry(value) }))}
          value={draft.industries}
          onValueChange={(next) => change({ industries: next })}
          placeholder={t("fields.industriesPlaceholder")}
          emptyLabel={t("fields.noMatch")}
          removeLabel={(name) => t("fields.removeTag", { name })}
          max={limits.choices}
          invalid={errorOf("industries") !== undefined}
          aria-describedby={about("industries", errorOf("industries"), true)}
        />
      </EditorField>
      <EditorField
        field="focusAreas"
        label={t("fields.focusAreas")}
        hint={t("fields.upTo", { max: limits.choices, chosen: draft.focusAreas.length })}
        error={errorOf("focusAreas")}
      >
        <CodeCombobox
          id={fieldId("focusAreas")}
          options={focusAreas.map((value) => ({ value, label: focusArea(value) }))}
          value={draft.focusAreas}
          onValueChange={(next) => change({ focusAreas: next })}
          placeholder={t("fields.focusAreasPlaceholder")}
          emptyLabel={t("fields.noMatch")}
          removeLabel={(name) => t("fields.removeTag", { name })}
          max={limits.choices}
          invalid={errorOf("focusAreas") !== undefined}
          aria-describedby={about("focusAreas", errorOf("focusAreas"), true)}
        />
      </EditorField>
      <EditorField field="languages" label={t("fields.languages")} optional={t("optional")}>
        <CodeCombobox
          id={fieldId("languages")}
          options={languages.map((value) => ({ value, label: language(value) }))}
          value={draft.languages}
          onValueChange={(next) => change({ languages: next })}
          placeholder={t("fields.languagesPlaceholder")}
          emptyLabel={t("fields.noMatch")}
          removeLabel={(name) => t("fields.removeTag", { name })}
          max={limits.languages}
        />
      </EditorField>
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
          value={draft.deployment}
          onValueChange={(next) => change({ deployment: next })}
        />
      </EditorField>
      <EditorField field="channels" label={t("fields.channels")} optional={t("optional")}>
        <Input
          id={fieldId("channels")}
          maxLength={limits.channels}
          placeholder={t("fields.channelsPlaceholder")}
          value={draft.channels}
          onChange={(event) => change({ channels: event.target.value })}
        />
      </EditorField>
      <EditorField
        field="bestCustomerProfile"
        label={t("fields.bestCustomerProfile")}
        optional={t("optional")}
        counter={t("counter", {
          count: draft.bestCustomerProfile.length,
          max: limits.bestCustomerProfile,
        })}
      >
        <Textarea
          id={fieldId("bestCustomerProfile")}
          rows={3}
          maxLength={limits.bestCustomerProfile}
          placeholder={t("fields.bestCustomerProfilePlaceholder")}
          value={draft.bestCustomerProfile}
          onChange={(event) => change({ bestCustomerProfile: event.target.value })}
        />
      </EditorField>
    </>
  );
}

type EvidenceStepProps = StepProps & {
  solutionId: string;
  /** Where the deck is read, once the solution names the file the editor holds. */
  deckHref: string | undefined;
  customerDeployments: CustomerDeployment[];
  /** A link field was left: from then on, what is wrong with it is said under it. */
  onLinkLeft: (field: LinkField) => void;
  /** An image under the cover finished uploading. */
  onImageAdded: (image: HeldImage) => void;
};

/**
 * Step 3: what the solution shows of itself, its logo, its cover and the images under it, then the
 * deck, a demo, the product's page and the projects customers put it to work in.
 */
function EvidenceStep({
  draft,
  change,
  errorOf,
  solutionId,
  deckHref,
  customerDeployments,
  onLinkLeft,
  onImageAdded,
}: EvidenceStepProps) {
  const t = useTranslations("Solution.editor");
  const link = (field: LinkField, hint: string, icon: React.ReactNode) => (
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
        placeholder="https://"
        maxLength={limits.link}
        value={draft[field]}
        onChange={(event) =>
          change(
            field === "demoUrl" ? { demoUrl: event.target.value } : { website: event.target.value },
          )
        }
        onBlur={() => onLinkLeft(field)}
        aria-invalid={errorOf(field) ? true : undefined}
        aria-describedby={about(field, errorOf(field), true)}
      />
    </EditorField>
  );

  return (
    <>
      <EditorField
        field="logo"
        label={t("fields.logo")}
        icon={<ImageIcon aria-hidden="true" />}
        hint={t("images.logo.hint")}
        error={errorOf("logo")}
        labelled={false}
      >
        <ImageUpload
          id={fieldId("logo")}
          place="logo"
          image={draft.logo}
          invalid={errorOf("logo") !== undefined}
          describedBy={about("logo", errorOf("logo"), true)}
          onChange={(logo) => change({ logo })}
        />
      </EditorField>
      <EditorField
        field="cover"
        label={t("fields.cover")}
        icon={<PanelTopIcon aria-hidden="true" />}
        hint={t("images.cover.hint")}
        error={errorOf("cover")}
        labelled={false}
      >
        <ImageUpload
          id={fieldId("cover")}
          place="cover"
          image={draft.cover}
          invalid={errorOf("cover") !== undefined}
          describedBy={about("cover", errorOf("cover"), true)}
          onChange={(cover) => change({ cover })}
        />
      </EditorField>
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
          images={draft.images}
          onAdd={onImageAdded}
          onChange={(images) => change({ images })}
        />
      </EditorField>
      <EditorField
        field="deck"
        label={t("fields.deck")}
        icon={<FileTextIcon aria-hidden="true" />}
        optional={t("optional")}
        labelled={false}
      >
        <DeckUpload
          id={fieldId("deck")}
          deck={draft.deck}
          href={deckHref}
          onChange={(deck) => change({ deck })}
        />
      </EditorField>
      {link("demoUrl", t("fields.demoUrlHint"), <CirclePlayIcon aria-hidden="true" />)}
      {link("website", t("fields.websiteHint"), <LinkIcon aria-hidden="true" />)}
      <CustomerDeploymentsEditor solutionId={solutionId} deployments={customerDeployments} />
    </>
  );
}

export { BasicsStep, EvidenceStep, FitStep };
