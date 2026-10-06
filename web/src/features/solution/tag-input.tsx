"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type TagInputProps = {
  id: string;
  /** The names so far, in the order they were added. */
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder: string;
  /** How many names the list takes; at the limit the field no longer takes a new one. */
  max: number;
  /** The longest name. */
  maxLength: number;
  /** The accessible name of the button that removes a name. */
  removeLabel: (name: string) => string;
  "aria-describedby"?: string;
};

/**
 * A short list of names a person types, such as what a solution is built with: each name is a chip
 * that can be removed, and Enter or a comma adds the one being typed. Leaving the field adds it too,
 * so a name is not lost because nobody pressed Enter.
 */
function TagInput({
  id,
  value,
  onValueChange,
  placeholder,
  max,
  maxLength,
  removeLabel,
  "aria-describedby": describedBy,
}: TagInputProps) {
  const [typed, setTyped] = useState("");
  const full = value.length >= max;

  function add() {
    const name = typed.trim();
    setTyped("");
    if (name && !full && !value.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      onValueChange([...value, name]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <li key={name}>
              <Badge variant="secondary">
                {name}
                <button
                  type="button"
                  aria-label={removeLabel(name)}
                  className="hit-area -mr-1 rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => onValueChange(value.filter((existing) => existing !== name))}
                >
                  <XIcon className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={typed}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={full}
        aria-describedby={describedBy}
        enterKeyHint="done"
        onChange={(event) => setTyped(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add();
          } else if (event.key === "Backspace" && typed === "" && value.length > 0) {
            onValueChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

export { TagInput };
