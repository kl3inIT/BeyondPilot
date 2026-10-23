"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { RequiredWord } from "@/components/composites/required-mark";
import { useFieldValidity } from "@/components/form/form-context";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { answerOfChosen, chosenOptions } from "@/lib/chosen-options";

/** The ids a control is described by, for `aria-describedby`: those of what is on the screen. */
function describedBy(...ids: unknown[]) {
  return ids.filter((id) => typeof id === "string" && id).join(" ") || undefined;
}

/**
 * A question answered by several choices: a named group of checkboxes. The answer is one text, the
 * chosen options as `answerOfChosen` writes them.
 */
function ChoicesField({
  id,
  label,
  optional,
  description,
  options,
}: {
  id: string;
  label: string;
  optional?: boolean;
  description?: ReactNode;
  options: string[];
}) {
  const t = useTranslations("Form");
  const { field, invalid, errors, required } = useFieldValidity<string | undefined>({
    optional,
  });
  const chosen = chosenOptions(field.state.value);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <FieldSet id={id} aria-describedby={describedBy(description && hintId, invalid && errorId)}>
      <FieldLegend variant="label">
        {label}{" "}
        {optional && <span className="font-normal text-muted-foreground">{t("optional")}</span>}
        {required && <RequiredWord />}
      </FieldLegend>
      {description && <FieldDescription id={hintId}>{description}</FieldDescription>}
      <FieldGroup data-slot="checkbox-group">
        {options.map((option, position) => (
          <Field key={option} orientation="horizontal">
            <Checkbox
              id={`${id}-${position}`}
              checked={chosen.includes(option)}
              onCheckedChange={(checked) =>
                field.handleChange(
                  // Kept in the order the question offers them, whatever order they were ticked in.
                  answerOfChosen(
                    options.filter((other) =>
                      other === option ? checked : chosen.includes(other),
                    ),
                  ),
                )
              }
              aria-invalid={invalid || undefined}
            />
            <FieldLabel htmlFor={`${id}-${position}`}>{option}</FieldLabel>
          </Field>
        ))}
      </FieldGroup>
      {invalid && <FieldError id={errorId} errors={errors} />}
    </FieldSet>
  );
}

export { ChoicesField };
