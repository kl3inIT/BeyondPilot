"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

type TagInputProps = {
  /** The id of the text box, so a label and a form's focus can reach it. */
  id?: string;
  /** The ids of the hint and the error that describe the field. */
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  value: string[];
  onValueChange: (value: string[]) => void;
  /** How many tags it holds at most; at the limit the text box stops taking new ones. */
  max?: number;
  /** The longest a tag may be. */
  maxLength?: number;
  /** The name of the button that removes a tag: "Remove Python". */
  removeLabel: (tag: string) => string;
  placeholder?: string;
  /** The label of the button that adds the typed text: "Add". */
  addLabel: string;
  /** Common tags offered under the box, each added with one click; the chosen ones are left out. */
  suggestions?: readonly string[];
  /** The line before the suggestions: "Suggested". */
  suggestionsLabel?: string;
  /** The name of a suggestion's button: "Add Python". */
  suggestLabel?: (tag: string) => string;
};

/** The tags in a piece of text, one per comma or line, each once and in the order typed. */
function tagsOf(text: string) {
  return text
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Words a person types freely, each kept as a tag they can remove: skills, tools. Enter, a comma or
 * leaving the box turns the text into a tag, a pasted list becomes one tag per item, and Backspace
 * in an empty box removes the last tag. The Add button does the same for a person who does not know
 * the keys, and suggestions add a common tag with one click. For a closed vocabulary use
 * `ChoiceChips` or a combobox.
 */
function TagInput({
  id,
  value,
  onValueChange,
  max,
  maxLength,
  removeLabel,
  placeholder,
  addLabel,
  suggestions = [],
  suggestionsLabel,
  suggestLabel,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  "aria-required": required,
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const full = max !== undefined && value.length >= max;
  const chosen = new Set(value.map((tag) => tag.toLowerCase()));
  const offered = full ? [] : suggestions.filter((tag) => !chosen.has(tag.toLowerCase()));

  function add(text: string) {
    const known = new Set(value.map((tag) => tag.toLowerCase()));
    const next = [...value];
    for (const tag of tagsOf(text)) {
      if (!known.has(tag.toLowerCase()) && (max === undefined || next.length < max)) {
        known.add(tag.toLowerCase());
        next.push(tag);
      }
    }
    if (next.length !== value.length) {
      onValueChange(next);
    }
    setDraft("");
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex min-h-10 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:bg-input/30">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex h-6 items-center rounded-sm bg-muted pl-1.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              aria-label={removeLabel(tag)}
              onClick={() => onValueChange(value.filter((other) => other !== tag))}
              className="flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon aria-hidden="true" className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={input}
          id={id}
          value={draft}
          readOnly={full}
          maxLength={maxLength}
          placeholder={full ? undefined : placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          aria-required={required}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => add(draft)}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (/[,\n]/.test(text)) {
              event.preventDefault();
              add(draft + text);
            }
          }}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === ",") && draft.trim()) {
              event.preventDefault();
              add(draft);
            } else if (event.key === "Enter") {
              // An empty box does not submit the form around it.
              event.preventDefault();
            } else if (event.key === "Backspace" && !draft && value.length > 0) {
              onValueChange(value.slice(0, -1));
            }
          }}
          className="h-7 min-w-32 flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        {!full && (
          <button
            type="button"
            // Keeps the focus in the box, so the typed text is still there when the click lands.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              add(draft);
              input.current?.focus();
            }}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            {addLabel}
          </button>
        )}
      </div>
      {offered.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {suggestionsLabel && (
            <span className="text-xs text-muted-foreground">{suggestionsLabel}</span>
          )}
          {offered.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-label={suggestLabel?.(tag)}
              onClick={() => add(tag)}
              className="flex h-6 items-center gap-1 rounded-sm border border-dashed border-input px-1.5 text-xs font-medium text-muted-foreground outline-none hover:border-ring hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <PlusIcon aria-hidden="true" className="size-3" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { TagInput };
