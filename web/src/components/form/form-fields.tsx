"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/actions/button";
import { RequiredMark } from "@/components/composites/required-mark";
import { useFieldValidity, useFormContext } from "@/components/form/form-context";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Labelled = {
  label: string;
  /** Marks the field as optional beside its label. */
  optional?: boolean;
  /** Marks the field as one that must be filled, with the red star beside its label. */
  requiredMark?: boolean;
  description?: ReactNode;
};

function FieldLabelText({
  label,
  optional,
  requiredMark,
  htmlFor,
}: Labelled & { htmlFor: string }) {
  const t = useTranslations("Form");
  return (
    <FieldLabel htmlFor={htmlFor}>
      {label}
      {requiredMark && <RequiredMark />}
      {optional && <span className="font-normal text-muted-foreground">{t("optional")}</span>}
    </FieldLabel>
  );
}

/**
 * The bound field with the ids of its hint and its error, and the `aria-describedby` that ties the
 * ones on the screen to the control, after any id the caller adds.
 */
function useDescribedField<TValue>(description: ReactNode, alsoDescribedBy?: string) {
  const { field, invalid, errors } = useFieldValidity<TValue>();
  const hintId = `${field.name}-hint`;
  const errorId = `${field.name}-error`;
  // An error without words marks the control and draws nothing, so there is nothing to point at.
  const worded = invalid && errors.some((error) => error?.message);
  const describedBy =
    [alsoDescribedBy, description ? hintId : undefined, worded ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return { field, invalid, errors, hintId, errorId, describedBy };
}

/** The shortest limit a text input counts against: below it nobody runs out while writing. */
const COUNTED_FROM = 60;

/**
 * The line under a control: its hint and, for a field with a limit, how much of it is used, at the
 * end of that line.
 */
function FieldHint({
  id,
  description,
  used,
  limit,
}: {
  id: string;
  description?: ReactNode;
  used: number;
  /** The field's limit when its use is counted. */
  limit?: number;
}) {
  const format = useFormatter();
  if (limit === undefined) {
    return description ? <FieldDescription id={id}>{description}</FieldDescription> : null;
  }
  return (
    <div className="flex items-start justify-between gap-3">
      {description ? <FieldDescription id={id}>{description}</FieldDescription> : <span />}
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {format.number(used)} / {format.number(limit)}
      </span>
    </div>
  );
}

type TextFieldProps = Labelled &
  Omit<ComponentProps<"input">, "id" | "name" | "value" | "onChange" | "onBlur"> & {
    /** Hides how much of `maxLength` is used: for a host, a key or another identifier. */
    uncounted?: boolean;
  };

/**
 * A line of text. With a `maxLength` a person can reach while writing, 60 characters or more on a
 * plain text input, it shows how much is used; an address, a password or a number does not, nor
 * does a field marked `uncounted`.
 */
function TextField({
  label,
  optional,
  requiredMark,
  description,
  uncounted,
  "aria-describedby": alsoDescribedBy,
  ...input
}: TextFieldProps) {
  const { field, invalid, errors, hintId, errorId, describedBy } = useDescribedField<string>(
    description,
    alsoDescribedBy,
  );
  const counted =
    !uncounted &&
    (input.type === undefined || input.type === "text") &&
    input.maxLength !== undefined &&
    input.maxLength >= COUNTED_FROM;
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelText
        label={label}
        optional={optional}
        requiredMark={requiredMark}
        htmlFor={field.name}
      />
      <Input
        {...input}
        id={field.name}
        name={field.name}
        value={field.state.value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      <FieldHint
        id={hintId}
        description={description}
        used={field.state.value.length}
        limit={counted ? input.maxLength : undefined}
      />
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
}

type TextareaFieldProps = Labelled &
  Omit<ComponentProps<"textarea">, "id" | "name" | "value" | "onChange" | "onBlur">;

/** Several lines of text. With a `maxLength` it shows how much is used. */
function TextareaField({
  label,
  optional,
  requiredMark,
  description,
  "aria-describedby": alsoDescribedBy,
  ...textarea
}: TextareaFieldProps) {
  const { field, invalid, errors, hintId, errorId, describedBy } = useDescribedField<string>(
    description,
    alsoDescribedBy,
  );
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelText
        label={label}
        optional={optional}
        requiredMark={requiredMark}
        htmlFor={field.name}
      />
      <Textarea
        {...textarea}
        id={field.name}
        name={field.name}
        value={field.state.value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      <FieldHint
        id={hintId}
        description={description}
        used={field.state.value.length}
        limit={textarea.maxLength}
      />
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
}

type SelectFieldProps = Labelled & {
  /** The choices, in the order they are offered. */
  options: { value: string; label: string }[];
  /** Shown while nothing is chosen. */
  placeholder?: string;
};

function SelectField({
  label,
  optional,
  requiredMark,
  description,
  options,
  placeholder,
}: SelectFieldProps) {
  const { field, invalid, errors, hintId, errorId, describedBy } =
    useDescribedField<string>(description);
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelText
        label={label}
        optional={optional}
        requiredMark={requiredMark}
        htmlFor={field.name}
      />
      <Select
        items={options}
        value={field.state.value || null}
        onValueChange={(value) => field.handleChange(String(value ?? ""))}
      >
        <SelectTrigger
          id={field.name}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="w-full"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {description && <FieldDescription id={hintId}>{description}</FieldDescription>}
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
}

type Option = { value: string; label: string };

/**
 * One choice out of a list too long to read whole, such as the organizations: typing narrows it and
 * the arrow opens all of it. A short list belongs in {@link SelectField}.
 */
function ComboboxField({
  label,
  optional,
  requiredMark,
  description,
  options,
  placeholder,
}: SelectFieldProps) {
  const t = useTranslations("Form");
  const { field, invalid, errors, hintId, errorId, describedBy } =
    useDescribedField<string>(description);
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelText
        label={label}
        optional={optional}
        requiredMark={requiredMark}
        htmlFor={field.name}
      />
      <Combobox
        autoHighlight
        items={options}
        value={options.find((option) => option.value === field.state.value) ?? null}
        isItemEqualToValue={(item: Option, other: Option) => item.value === other.value}
        onValueChange={(next: Option | null) => field.handleChange(next?.value ?? "")}
      >
        <ComboboxInput
          id={field.name}
          className="w-full"
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onBlur={field.handleBlur}
        />
        <ComboboxContent>
          <ComboboxEmpty>{t("noMatch")}</ComboboxEmpty>
          {/* The list names itself: a listbox without a name is nothing to a screen reader. */}
          <ComboboxList aria-label={label}>
            {(option: Option) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {description && <FieldDescription id={hintId}>{description}</FieldDescription>}
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
}

function CheckboxField({ label, disabled }: { label: string; disabled?: boolean }) {
  const { field, invalid, errors, errorId, describedBy } = useDescribedField<boolean>(undefined);
  return (
    <Field orientation="horizontal" data-invalid={invalid || undefined}>
      <Checkbox
        id={field.name}
        name={field.name}
        checked={field.state.value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onCheckedChange={(checked) => field.handleChange(checked === true)}
      />
      <FieldContent>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {invalid && <FieldError id={errorId} errors={errors} />}
      </FieldContent>
    </Field>
  );
}

type SubmitButtonProps = {
  children: ReactNode;
  tone?: ComponentProps<typeof Button>["tone"];
  prominence?: ComponentProps<typeof Button>["prominence"];
  size?: ComponentProps<typeof Button>["size"];
  disabled?: boolean;
  className?: string;
};

/** Submits the form and shows it pending while `onSubmit` runs. */
function SubmitButton({ disabled, ...props }: SubmitButtonProps) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(submitting) => (
        <Button {...props} type="submit" disabled={disabled || submitting} pending={submitting} />
      )}
    </form.Subscribe>
  );
}

/** The form-level error a failed submission leaves, such as a refusal that names no field. */
function FormError() {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.errorMap.onServer}>
      {(error) => {
        // TanStack Form keeps the `form` part of the errors setServerErrors gave as the form's own error.
        const message = typeof error === "string" ? error : undefined;
        return message ? <FieldError>{message}</FieldError> : null;
      }}
    </form.Subscribe>
  );
}

export {
  CheckboxField,
  ComboboxField,
  FormError,
  SelectField,
  SubmitButton,
  TextareaField,
  TextField,
};
