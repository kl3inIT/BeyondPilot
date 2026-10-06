"use client";

import { CircleAlertIcon, CircleCheckIcon, ListChecksIcon } from "lucide-react";

import { TextButton } from "@/components/actions/text-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { focusField } from "@/lib/focus-field";

type ReviewReadinessProps = {
  /** The line above the fields still to fill in: "Before you send it for review, add". */
  missingTitle: string;
  /** The line when nothing is missing. */
  readyTitle: string;
  /** What the review looks at and how long it takes. */
  note: string;
  /** The fields a review needs and the form does not hold yet, each by the id of its control. */
  missing: { id: string; label: string }[];
  /** True after a refused attempt to send: the list then reads as the error it is. */
  refused: boolean;
  /**
   * What choosing a field does, by its id. The default moves focus to it; a form in steps opens the
   * step that holds it first.
   */
  onSelect?: (id: string) => void;
};

/**
 * What stands between a form and its review, above the button that asks for it: the fields still to
 * fill in, each a way to that field, or the word that it is ready. A person learns what a review
 * needs before the first attempt, not from its refusal.
 */
function ReviewReadiness({
  missingTitle,
  readyTitle,
  note,
  missing,
  refused,
  onSelect = focusField,
}: ReviewReadinessProps) {
  if (missing.length === 0) {
    return (
      <Alert role="note">
        <CircleCheckIcon aria-hidden="true" />
        <AlertTitle>{readyTitle}</AlertTitle>
        <AlertDescription>{note}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant={refused ? "destructive" : "default"} role={refused ? "alert" : "note"}>
      {refused ? <CircleAlertIcon aria-hidden="true" /> : <ListChecksIcon aria-hidden="true" />}
      <AlertTitle>{missingTitle}</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-2">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {missing.map((field) => (
              <li key={field.id}>
                <TextButton
                  tone={refused ? "danger" : "default"}
                  onClick={() => onSelect(field.id)}
                >
                  {field.label}
                </TextButton>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">{note}</p>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export { ReviewReadiness };
