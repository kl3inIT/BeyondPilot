"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ChoiceSelectOption = { value: string; label: string };

type ChoiceSelectProps = {
  id: string;
  options: ChoiceSelectOption[];
  /** The chosen option's value; an empty string means nothing is chosen yet. */
  value: string;
  onValueChange: (value: string) => void;
  /** Shown while nothing is chosen. */
  placeholder?: string;
  "aria-invalid"?: boolean;
};

/** A field that picks one of a fixed list, with the list drawn by the app rather than the browser. */
function ChoiceSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder,
  "aria-invalid": invalid,
}: ChoiceSelectProps) {
  return (
    <Select
      items={options}
      value={value || null}
      onValueChange={(chosen) => onValueChange(chosen ?? "")}
    >
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
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
  );
}

export { ChoiceSelect };
