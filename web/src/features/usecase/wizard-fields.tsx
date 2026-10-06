"use client";

import { useFormatter } from "next-intl";
import { createContext, useContext, useId, type ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
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

/*
 * The fields of the wizard hold their value in the wizard, which saves it as it changes. The same
 * fields are drawn for the people who only review a use case: inside a ReadOnlyProvider none of them
 * can be changed.
 */

const ReadOnly = createContext(false);

/** Makes every field below it read only. */
function ReadOnlyProvider({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return <ReadOnly.Provider value={readOnly}>{children}</ReadOnly.Provider>;
}

type Labelled = {
  label: string;
  /** Marks the field as optional beside its label. */
  optionalLabel?: string;
  hint?: ReactNode;
};

function LabelText({ label, optionalLabel, htmlFor }: Labelled & { htmlFor: string }) {
  return (
    <FieldLabel htmlFor={htmlFor}>
      {label}
      {optionalLabel && <span className="font-normal text-muted-foreground"> {optionalLabel}</span>}
    </FieldLabel>
  );
}

type TextInputProps = Labelled &
  Omit<React.ComponentProps<"input">, "id" | "value" | "onChange" | "size"> & {
    value: string;
    onValueChange: (value: string) => void;
  };

function TextInput({
  label,
  optionalLabel,
  hint,
  value,
  onValueChange,
  disabled,
  ...input
}: TextInputProps) {
  const id = useId();
  const readOnly = useContext(ReadOnly);
  return (
    <Field>
      <LabelText label={label} optionalLabel={optionalLabel} htmlFor={id} />
      <Input
        {...input}
        id={id}
        value={value}
        disabled={readOnly || disabled}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

type TextAreaProps = Labelled & {
  value: string;
  onValueChange: (value: string) => void;
  maxLength: number;
  rows?: number;
};

/** A long text with its hint and how much of the limit it uses, as the design shows them. */
function TextArea({
  label,
  optionalLabel,
  hint,
  value,
  onValueChange,
  maxLength,
  rows = 4,
}: TextAreaProps) {
  const id = useId();
  const format = useFormatter();
  const readOnly = useContext(ReadOnly);
  return (
    <Field>
      <LabelText label={label} optionalLabel={optionalLabel} htmlFor={id} />
      <Textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        disabled={readOnly}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <div className="flex items-start justify-between gap-3">
        {hint ? <FieldDescription>{hint}</FieldDescription> : <span />}
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {format.number(value.length)} / {format.number(maxLength)}
        </span>
      </div>
    </Field>
  );
}

type ChoiceProps = Labelled & {
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
};

function Choice({
  label,
  optionalLabel,
  hint,
  options,
  value,
  onValueChange,
  placeholder,
}: ChoiceProps) {
  const id = useId();
  const readOnly = useContext(ReadOnly);
  return (
    <Field>
      <LabelText label={label} optionalLabel={optionalLabel} htmlFor={id} />
      <Select
        items={options}
        value={value || null}
        disabled={readOnly}
        onValueChange={(next) => onValueChange(String(next ?? ""))}
      >
        <SelectTrigger id={id} className="w-full">
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
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

type TickProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** A single yes or no, with its words beside it. */
function Tick({ label, checked, onCheckedChange, disabled }: TickProps) {
  const id = useId();
  const readOnly = useContext(ReadOnly);
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        checked={checked}
        disabled={readOnly || disabled}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
      </FieldContent>
    </Field>
  );
}

export { Choice, ReadOnlyProvider, TextArea, TextInput, Tick };
