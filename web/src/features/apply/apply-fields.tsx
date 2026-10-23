"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { PdfUpload, type PdfFile } from "@/components/composites/pdf-upload";
import { RequiredWord } from "@/components/composites/required-mark";
import { useFieldValidity } from "@/components/form/form-context";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

// The controls of the application form that the shared set lacks. Each is rendered inside
// `form.AppField`, which holds its value, and ties its hint and its error to the control. The form
// says every field is required unless marked Optional, so each says it must be filled when it is
// not `optional`: with `aria-required` where the role takes it, in its name otherwise.

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
  const { field, invalid, errors, ids, required } = useFieldValidity<string>({ optional });
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
        aria-required={required}
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
  const { invalid, errors, required } = useFieldValidity<unknown>({ optional });
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = describedBy(description && hintId, invalid && errorId);
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional && <Optional />}
        {/* The upload is a button and a file input, and neither takes `aria-required`. */}
        {required && <RequiredWord />}
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

/** A question answered by agreeing: its answer is the text "true", or nothing. */
function AgreementField({
  id,
  label,
  required: mustAgree,
  description,
}: {
  id: string;
  label: string;
  /** The application cannot go without the agreement. */
  required: boolean;
  description?: ReactNode;
}) {
  const { field, invalid, errors, required } = useFieldValidity<string | undefined>({
    required: mustAgree,
  });
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <Field orientation="horizontal" data-invalid={invalid || undefined}>
      <Checkbox
        id={id}
        checked={field.state.value === "true"}
        onCheckedChange={(checked) => field.handleChange(checked ? "true" : "")}
        aria-invalid={invalid || undefined}
        aria-required={required}
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

export { AgreementField, NativeSelectField, Optional, PdfField };
