"use client";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";

type Option = { value: string; label: string };

type CodeComboboxProps = {
  id: string;
  /** Every code of the vocabulary with its words, in the order the list offers them. */
  options: Option[];
  /** The chosen codes, in the order they were chosen. */
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder: string;
  /** What the list says when nothing matches what was typed. */
  emptyLabel: string;
  /** The accessible name of the button that removes a chosen code. */
  removeLabel: (label: string) => string;
  /** How many may be chosen; at the limit the list offers only what is already chosen. */
  max: number;
  invalid?: boolean;
  "aria-describedby"?: string;
};

/**
 * A few codes out of a long vocabulary, such as the industries of a solution: the chosen ones are
 * chips in the field, and typing narrows the list. A short vocabulary a person reads whole belongs
 * in `ChoiceChips`.
 */
function CodeCombobox({
  id,
  options,
  value,
  onValueChange,
  placeholder,
  emptyLabel,
  removeLabel,
  max,
  invalid,
  "aria-describedby": describedBy,
}: CodeComboboxProps) {
  const anchor = useComboboxAnchor();
  const chosen = value.flatMap((code) => options.find((option) => option.value === code) ?? []);
  const full = value.length >= max;

  return (
    <Combobox
      multiple
      autoHighlight
      items={options}
      value={chosen}
      isItemEqualToValue={(item: Option, other: Option) => item.value === other.value}
      onValueChange={(next: Option[]) => onValueChange(next.map((option) => option.value))}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(selected: Option[]) => (
            <>
              {selected.map((option) => (
                <ComboboxChip key={option.value} removeLabel={removeLabel(option.label)}>
                  {option.label}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                placeholder={placeholder}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        {/* The list names itself: a listbox without a name is nothing to a screen reader. */}
        <ComboboxList aria-label={placeholder}>
          {(option: Option) => (
            <ComboboxItem
              key={option.value}
              value={option}
              disabled={full && !value.includes(option.value)}
            >
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export { CodeCombobox };
