"use client";

import { CheckIcon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ChoiceChipsProps = {
  /** The group's id, so a form can move focus to it. */
  id?: string;
  /** The ids of the hint and the error that describe the group. */
  "aria-describedby"?: string;
  /** The name of the group for assistive technology, usually the field's label. */
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onValueChange: (value: string[]) => void;
  /** How many may be chosen; at the limit the other chips cannot be chosen. */
  max?: number;
  disabled?: boolean;
};

/**
 * A few choices out of a short vocabulary, each a chip that is on or off. For a list a person reads
 * whole before choosing; a long list belongs in a combobox. A chosen chip carries a check mark, so
 * the choice does not rest on colour alone.
 */
function ChoiceChips({
  id,
  label,
  options,
  value,
  onValueChange,
  max,
  disabled,
  "aria-describedby": describedBy,
}: ChoiceChipsProps) {
  const full = max !== undefined && value.length >= max;

  return (
    <ToggleGroup
      id={id}
      multiple
      aria-label={label}
      aria-describedby={describedBy}
      variant="outline"
      size="sm"
      className="w-full flex-wrap"
      value={value}
      disabled={disabled}
      onValueChange={onValueChange}
    >
      {options.map((option) => {
        const on = value.includes(option.value);
        return (
          <ToggleGroupItem key={option.value} value={option.value} disabled={full && !on}>
            {on && <CheckIcon aria-hidden="true" />}
            {option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export { ChoiceChips };
