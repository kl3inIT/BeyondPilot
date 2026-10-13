"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/actions/button";
import { RequiredMark } from "@/components/composites/required-mark";
import { Reveal } from "@/components/composites/reveal";
import {
  RequiredUnlessOptional,
  useFieldValidity,
  useFormContext,
  type RequiredMarks,
} from "@/components/form/form-context";
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
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormatter } from "@/i18n/format";

/**
 * A field's label and hint, and what it says about having to be filled (`optional`, `requiredMark`,
 * `required`): the control says it to a screen reader with `aria-required`, as `useFieldValidity`
 * works it out.
 */
type Labelled = RequiredMarks & {
  label: string;
  description?: ReactNode;
};

/**
 * Wraps the fields of a form that says, in words above them, that every field must be filled unless
 * it is marked Optional. The controls inside say so one by one to a screen reader: each is
 * `aria-required` unless it is `optional` or `required={false}`. A box to tick is never required
 * by this, only by its own `required`.
 */
function AllRequired({ children }: { children: ReactNode }) {
  return <RequiredUnlessOptional value>{children}</RequiredUnlessOptional>;
}

function FieldLabelText({
  label,
  optional,
  requiredMark,
  htmlFor,
}: Pick<Labelled, "label" | "optional" | "requiredMark"> & { htmlFor: string }) {
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
 * The bound field with the ids of its control, its hint and its error, which start with the form's
 * id, and the `aria-describedby` that ties the hint and the error on the screen to the control,
 * after any id the caller adds. `required` is the control's `aria-required` and `errorRole` the
 * role of its error, which announces itself only when no submit moved the focus to it.
 */
function useDescribedField<TValue>(
  description: ReactNode,
  alsoDescribedBy?: string,
  marks?: RequiredMarks,
) {
  const { field, invalid, errors, ids, required, spoken } = useFieldValidity<TValue>(marks);
  // An error without words marks the control and draws nothing, so there is nothing to point at.
  const worded = invalid && errors.some((error) => error?.message);
  const describedBy =
    [alsoDescribedBy, description ? ids.hint : undefined, worded ? ids.error : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return {
    field,
    invalid,
    errors,
    controlId: ids.control,
    hintId: ids.hint,
    errorId: ids.error,
    describedBy,
    required,
    errorRole: spoken ? ("alert" as const) : undefined,
  };
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
  required: mustFill,
  description,
  uncounted,
  "aria-describedby": alsoDescribedBy,
  ...input
}: TextFieldProps) {
  const { field, invalid, errors, controlId, hintId, errorId, describedBy, required, errorRole } =
    useDescribedField<string>(description, alsoDescribedBy, {
      optional,
      requiredMark,
      required: mustFill,
    });
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
        htmlFor={controlId}
      />
      <Input
        {...input}
        id={controlId}
        name={field.name}
        value={field.state.value}
        aria-invalid={invalid || undefined}
        aria-required={required}
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
      <Reveal open={invalid}>
        <FieldError id={errorId} role={errorRole} errors={errors} />
      </Reveal>
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
  required: mustFill,
  description,
  "aria-describedby": alsoDescribedBy,
  ...textarea
}: TextareaFieldProps) {
  const { field, invalid, errors, controlId, hintId, errorId, describedBy, required, errorRole } =
    useDescribedField<string>(description, alsoDescribedBy, {
      optional,
      requiredMark,
      required: mustFill,
    });
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelText
        label={label}
        optional={optional}
        requiredMark={requiredMark}
        htmlFor={controlId}
      />
      <Textarea
        {...textarea}
        id={controlId}
        name={field.name}
        value={field.state.value}
        aria-invalid={invalid || undefined}
        aria-required={required}
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
      <Reveal open={invalid}>
        <FieldError id={errorId} role={errorRole} errors={errors} />
      </Reveal>
    </Field>
  );
}

type SelectFieldProps = Labelled & {
  /** The choices, in the order they are offered. */
  options: { value: string; label: string }[];
  /** Shown while nothing is chosen. */
  placeholder?: string;
  disabled?: boolean;
};

function SelectField({
  label,
  optional,
  requiredMark,
  required: mustFill,
  description,
  options,
  placeholder,
  disabled,
}: SelectFieldProps) {
  const { field, invalid, errors, controlId, hintId, errorId, describedBy, required, errorRole } =
    useDescribedField<string>(description, undefined, {
      optional,
      requiredMark,
      required: mustFill,
    });
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelText
        label={label}
        optional={optional}
        requiredMark={requiredMark}
        htmlFor={controlId}
      />
      <Select
        items={options}
        value={field.state.value || null}
        disabled={disabled}
        onValueChange={(value) => field.handleChange(String(value ?? ""))}
      >
        <SelectTrigger
          id={controlId}
          aria-invalid={invalid || undefined}
          aria-required={required}
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
      <Reveal open={invalid}>
        <FieldError id={errorId} role={errorRole} errors={errors} />
      </Reveal>
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
  required: mustFill,
  description,
  options,
  placeholder,
}: SelectFieldProps) {
  const t = useTranslations("Form");
  const { field, invalid, errors, hintId, errorId, describedBy, required, errorRole } =
    useDescribedField<string>(description, undefined, {
      optional,
      requiredMark,
      required: mustFill,
    });
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
          aria-required={required}
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
      <Reveal open={invalid}>
        <FieldError id={errorId} role={errorRole} errors={errors} />
      </Reveal>
    </Field>
  );
}

type ChoiceCardsFieldProps = {
  label: string;
  description?: ReactNode;
  /** A line about the choice made, under the hint. */
  note?: ReactNode;
  options: { value: string; label: string; what: string }[];
  /** What a choice asks for beyond itself, under the group with the field's error. */
  detail?: ReactNode;
};

/**
 * One choice among a few, each on a card with a line that says what it means. Rendered inside
 * `form.AppField`, which holds its value.
 */
function ChoiceCardsField({ label, description, note, options, detail }: ChoiceCardsFieldProps) {
  const { field, invalid, errors, controlId, hintId, errorId, describedBy, required } =
    useDescribedField<string>(description);
  return (
    <>
      <Field data-invalid={invalid || undefined}>
        <FieldLabel>{label}</FieldLabel>
        <RadioGroup
          id={controlId}
          value={field.state.value}
          onValueChange={(value) => field.handleChange(String(value))}
          aria-label={label}
          aria-required={required}
          aria-describedby={describedBy}
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

type CheckboxFieldProps = {
  label: string;
  disabled?: boolean;
  /** The box must be ticked for the form to go: a confirmation. Nothing else says it. */
  required?: boolean;
};

function CheckboxField({ label, disabled, required: mustTick = false }: CheckboxFieldProps) {
  const { field, invalid, errors, controlId, errorId, describedBy, required, errorRole } =
    useDescribedField<boolean>(undefined, undefined, { required: mustTick });
  return (
    <Field orientation="horizontal" data-invalid={invalid || undefined}>
      <Checkbox
        id={controlId}
        name={field.name}
        checked={field.state.value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-required={required}
        aria-describedby={describedBy}
        onCheckedChange={(checked) => field.handleChange(checked === true)}
      />
      <FieldContent>
        <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
        <Reveal open={invalid}>
          <FieldError id={errorId} role={errorRole} errors={errors} />
        </Reveal>
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
        return (
          <Reveal open={message !== undefined}>
            <FieldError>{message}</FieldError>
          </Reveal>
        );
      }}
    </form.Subscribe>
  );
}

export {
  AllRequired,
  CheckboxField,
  ChoiceCardsField,
  ComboboxField,
  FormError,
  SelectField,
  SubmitButton,
  TextareaField,
  TextField,
};
