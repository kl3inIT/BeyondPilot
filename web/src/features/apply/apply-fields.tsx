"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { PdfUpload, type PdfFile } from "@/components/composites/pdf-upload";
import { useFieldValidity } from "@/components/form/form-context";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { answerOfChosen, chosenOptions } from "@/lib/chosen-options";

// The controls of the application form that the shared set lacks. Each is rendered inside
// `form.AppField`, which holds its value, and ties its hint and its error to the control.

/** The ids a control is described by, for `aria-describedby`: those of what is on the screen. */
function describedBy(...ids: unknown[]) {
  return ids.filter((id) => typeof id === "string" && id).join(" ") || undefined;
}

function Optional() {
  const t = useTranslations("Apply");
  return <span className="font-normal text-muted-foreground">{t("optional")}</span>;
}

type Option = { value: string; label: string };

/** One choice from a list, as the browser's own select. */
function NativeSelectField({
  label,
  optional,
  description,
  placeholder,
  options,
}: {
  label: string;
  optional?: boolean;
  description?: ReactNode;
  /** The choice that stands for nothing chosen; without it the first option is chosen. */
  placeholder?: string;
  options: Option[];
}) {
  const { field, invalid, errors, ids } = useFieldValidity<string>();
  const { control: controlId, hint: hintId, error: errorId } = ids;
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={controlId}>
        {label}
        {optional && <Optional />}
      </FieldLabel>
      <NativeSelect
        id={controlId}
        name={field.name}
        className="w-full"
        value={field.state.value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(description && hintId, invalid && errorId)}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      >
        {placeholder !== undefined && (
          <NativeSelectOption value="">{placeholder}</NativeSelectOption>
        )}
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {description && <FieldDescription id={hintId}>{description}</FieldDescription>}
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
}

/**
 * One choice among a few, each with a line that says what it means. `detail` goes under the group
 * with its own error, for a choice that asks for more than the choice itself.
 */
function ChoiceCardsField({
  label,
  description,
  note,
  options,
  detail,
}: {
  label: string;
  description?: ReactNode;
  /** A line about the choice made, under the hint. */
  note?: ReactNode;
  options: (Option & { what: string })[];
  detail?: ReactNode;
}) {
  const { field, invalid, errors, ids } = useFieldValidity<string>();
  const { control: controlId, hint: hintId, error: errorId } = ids;
  return (
    <>
      <Field data-invalid={invalid || undefined}>
        <FieldLabel>{label}</FieldLabel>
        <RadioGroup
          id={controlId}
          value={field.state.value}
          onValueChange={(value) => field.handleChange(String(value))}
          aria-label={label}
          aria-describedby={describedBy(description && hintId, invalid && errorId)}
        >
          {options.map((option) => (
            <FieldLabel key={option.value} htmlFor={`${controlId}-${option.value}`}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{option.label}</FieldTitle>
                  <FieldDescription>{option.what}</FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  value={option.value}
                  id={`${controlId}-${option.value}`}
                  aria-invalid={invalid || undefined}
                />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
        {description && <FieldDescription id={hintId}>{description}</FieldDescription>}
        {invalid && !detail && <FieldError id={errorId} errors={errors} />}
        {note && <FieldDescription>{note}</FieldDescription>}
      </Field>
      {detail && (
        <section className="flex flex-col gap-3">
          {detail}
          {invalid && <FieldError id={errorId} errors={errors} />}
        </section>
      )}
    </>
  );
}

/**
 * A PDF uploaded at once. The caller reads the file from the field and writes it back, since one
 * field holds the file and another only its identifier.
 */
function PdfField({
  id,
  label,
  optional,
  description,
  value,
  onChange,
}: {
  /** The id of the file input, which the label names. */
  id: string;
  label: string;
  optional?: boolean;
  description?: ReactNode;
  value: PdfFile | null;
  onChange: (file: PdfFile | null) => void;
}) {
  const { invalid, errors } = useFieldValidity<unknown>();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = describedBy(description && hintId, invalid && errorId);
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional && <Optional />}
      </FieldLabel>
      {/*
        The upload does not say it is in error, and a refused step gives the focus to the first
        control that does: this says it for the upload and hands that focus to its button.
      */}
      <div
        aria-invalid={invalid || undefined}
        tabIndex={-1}
        onFocus={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget
              .querySelector<HTMLElement>("button:not(:disabled)")
              ?.focus({ preventScroll: true });
          }
        }}
      >
        <PdfUpload
          id={id}
          value={value}
          invalid={invalid}
          describedBy={described}
          onChange={onChange}
        />
      </div>
      {description && <FieldDescription id={hintId}>{description}</FieldDescription>}
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
}

/**
 * A question answered by several choices: a named group of checkboxes. The answer is one text, the
 * chosen options as `answerOfChosen` writes them.
 */
function ChoicesField({
  id,
  label,
  optional,
  description,
  options,
}: {
  id: string;
  label: string;
  optional?: boolean;
  description?: ReactNode;
  options: string[];
}) {
  const { field, invalid, errors } = useFieldValidity<string | undefined>();
  const chosen = chosenOptions(field.state.value);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <FieldSet id={id} aria-describedby={describedBy(description && hintId, invalid && errorId)}>
      <FieldLegend variant="label">
        {label} {optional && <Optional />}
      </FieldLegend>
      {description && <FieldDescription id={hintId}>{description}</FieldDescription>}
      <FieldGroup data-slot="checkbox-group">
        {options.map((option, position) => (
          <Field key={option} orientation="horizontal">
            <Checkbox
              id={`${id}-${position}`}
              checked={chosen.includes(option)}
              onCheckedChange={(checked) =>
                field.handleChange(
                  // Kept in the order the question offers them, whatever order they were ticked in.
                  answerOfChosen(
                    options.filter((other) =>
                      other === option ? checked : chosen.includes(other),
                    ),
                  ),
                )
              }
              aria-invalid={invalid || undefined}
            />
            <FieldLabel htmlFor={`${id}-${position}`}>{option}</FieldLabel>
          </Field>
        ))}
      </FieldGroup>
      {invalid && <FieldError id={errorId} errors={errors} />}
    </FieldSet>
  );
}

/** A question answered by agreeing: its answer is the text "true", or nothing. */
function AgreementField({
  id,
  label,
  description,
}: {
  id: string;
  label: string;
  description?: ReactNode;
}) {
  const { field, invalid, errors } = useFieldValidity<string | undefined>();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <Field orientation="horizontal" data-invalid={invalid || undefined}>
      <Checkbox
        id={id}
        checked={field.state.value === "true"}
        onCheckedChange={(checked) => field.handleChange(checked ? "true" : "")}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(description && hintId, invalid && errorId)}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription id={hintId}>{description}</FieldDescription>}
        {invalid && <FieldError id={errorId} errors={errors} />}
      </FieldContent>
    </Field>
  );
}

export { AgreementField, ChoiceCardsField, ChoicesField, NativeSelectField, Optional, PdfField };
