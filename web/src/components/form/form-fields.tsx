"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/actions/button";
import { useFieldValidity, useFormContext } from "@/components/form/form-context";
import { Checkbox } from "@/components/ui/checkbox";
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
  description?: ReactNode;
};

function FieldLabelText({ label, optional, htmlFor }: Labelled & { htmlFor: string }) {
  const t = useTranslations("Form");
  return (
    <FieldLabel htmlFor={htmlFor}>
      {label}
      {optional && <span className="font-normal text-muted-foreground">{t("optional")}</span>}
    </FieldLabel>
  );
}

type TextFieldProps = Labelled &
  Omit<ComponentProps<"input">, "id" | "name" | "value" | "onChange" | "onBlur">;

function TextField({ label, optional, description, ...input }: TextFieldProps) {
  const { field, invalid, errors } = useFieldValidity<string>();
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelText label={label} optional={optional} htmlFor={field.name} />
      <Input
        {...input}
        id={field.name}
        name={field.name}
        value={field.state.value}
        aria-invalid={invalid || undefined}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  );
}

type TextareaFieldProps = Labelled &
  Omit<ComponentProps<"textarea">, "id" | "name" | "value" | "onChange" | "onBlur">;

function TextareaField({ label, optional, description, ...textarea }: TextareaFieldProps) {
  const { field, invalid, errors } = useFieldValidity<string>();
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelText label={label} optional={optional} htmlFor={field.name} />
      <Textarea
        {...textarea}
        id={field.name}
        name={field.name}
        value={field.state.value}
        aria-invalid={invalid || undefined}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  );
}

type SelectFieldProps = Labelled & {
  /** The choices, in the order they are offered. */
  options: { value: string; label: string }[];
};

function SelectField({ label, optional, description, options }: SelectFieldProps) {
  const { field, invalid, errors } = useFieldValidity<string>();
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelText label={label} optional={optional} htmlFor={field.name} />
      <Select
        items={options}
        value={field.state.value}
        onValueChange={(value) => field.handleChange(String(value))}
      >
        <SelectTrigger id={field.name} aria-invalid={invalid || undefined} className="w-full">
          <SelectValue />
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
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  );
}

function CheckboxField({ label, disabled }: { label: string; disabled?: boolean }) {
  const { field, invalid, errors } = useFieldValidity<boolean>();
  return (
    <Field orientation="horizontal" data-invalid={invalid || undefined}>
      <Checkbox
        id={field.name}
        name={field.name}
        checked={field.state.value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onCheckedChange={(checked) => field.handleChange(checked === true)}
      />
      <FieldContent>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {invalid && <FieldError errors={errors} />}
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
        const message =
          error && typeof error === "object" && "form" in error && typeof error.form === "string"
            ? error.form
            : undefined;
        return message ? <FieldError>{message}</FieldError> : null;
      }}
    </form.Subscribe>
  );
}

export { CheckboxField, FormError, SelectField, SubmitButton, TextareaField, TextField };
