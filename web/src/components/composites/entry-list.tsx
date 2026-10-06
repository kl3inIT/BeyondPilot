"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type EntryListProps = {
  id: string;
  /** What the field is called, for the label of each entry's remove button. */
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max: number;
  maxLength: number;
  describedBy?: string;
};

/**
 * A short list a person types, such as the tools a solution is built with: Enter or a comma adds
 * what is typed, each entry shows as a badge with its own remove button, and repeats are ignored.
 */
function EntryList({
  id,
  label,
  value,
  onChange,
  placeholder,
  max,
  maxLength,
  describedBy,
}: EntryListProps) {
  const t = useTranslations("EntryList");
  const [draft, setDraft] = useState("");

  function add() {
    const entry = draft.trim();
    setDraft("");
    if (entry && value.length < max && !value.includes(entry)) {
      onChange([...value, entry]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {value.map((entry) => (
            <li key={entry}>
              <Badge variant="outline">
                {entry}
                <button
                  type="button"
                  aria-label={t("remove", { entry, label })}
                  onClick={() => onChange(value.filter((other) => other !== entry))}
                  className="hit-area rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={value.length >= max}
        aria-describedby={describedBy}
        onChange={(event) => setDraft(event.target.value.replace(",", ""))}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add();
          } else if (event.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

export { EntryList };
