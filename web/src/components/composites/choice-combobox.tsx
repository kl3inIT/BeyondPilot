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

type ChoiceComboboxProps = {
  /** The id of the text field, so a form can move focus to it. */
  id?: string;
  /** The ids of the hint and the error that describe the field. */
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** The name of the field for assistive technology, usually its label. */
  label: string;
  placeholder?: string;
  /** What the list says when the typed text matches nothing. */
  emptyLabel: string;
  /** The name of the button that takes a chosen option off, given the option's label. */
  removeLabel: (option: string) => string;
  options: { value: string; label: string }[];
  value: string[];
  onValueChange: (value: string[]) => void;
  /** How many may be chosen; at the limit the other options cannot be chosen. */
  max?: number;
};

/**
 * A few choices out of a long vocabulary, typed to find and shown as removable chips. For a list too
 * long to read whole; a short one belongs in {@link ChoiceChips}.
 */
function ChoiceCombobox({
  id,
  label,
  placeholder,
  emptyLabel,
  removeLabel,
  options,
  value,
  onValueChange,
  max,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: ChoiceComboboxProps) {
  const anchor = useComboboxAnchor();
  const labels = new Map(options.map((option) => [option.value, option.label]));
  const full = max !== undefined && value.length >= max;
  const labelOf = (code: string) => labels.get(code) ?? code;

  return (
    <Combobox
      multiple
      autoHighlight
      items={options.map((option) => option.value)}
      value={value}
      onValueChange={onValueChange}
      itemToStringLabel={labelOf}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(chosen: string[]) => (
            <>
              {chosen.map((code) => (
                <ComboboxChip key={code} removeLabel={removeLabel(labelOf(code))}>
                  {labelOf(code)}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                aria-label={label}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder={chosen.length === 0 ? placeholder : undefined}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(code: string) => (
            <ComboboxItem key={code} value={code} disabled={full && !value.includes(code)}>
              {labelOf(code)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export { ChoiceCombobox };
