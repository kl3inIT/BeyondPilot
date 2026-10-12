import { revalidateLogic, type AnyFormApi } from "@tanstack/react-form";

import type { ApplyValues } from "./apply-values";

/** What a check refuses in what the form holds, by the form's field. */
type Problems = Record<string, { message: string }> | undefined;

/**
 * How the application form checks itself. Continue and Submit are both its submit: the step on the
 * screen is checked on that submit and from then on as the person types, and a field the backend
 * would refuse says so when it is left.
 *
 * Every rule is the form's, none a field's own: the check on leaving a field reads the same schema
 * as the backend's, for the whole contact at once.
 */
export function applyFormOptions(options: {
  defaults: ApplyValues;
  /** What the step on the screen refuses. */
  problems: (values: ApplyValues) => Problems;
  /** What is refused as soon as its field is left, before any submit. */
  problemsOnLeaving: (values: ApplyValues) => Problems;
  /** A person changed the field of this name. */
  changed: (field: string) => void;
  submit: (values: ApplyValues) => Promise<void>;
}) {
  const fieldsOf = (fields: Problems) => (fields ? { fields } : undefined);
  return {
    defaultValues: options.defaults,
    validationLogic: revalidateLogic(),
    // A field refused when it was left does not keep the step from being checked as a whole.
    canSubmitWhenInvalid: true,
    validators: {
      onBlur: ({ value }: { value: ApplyValues }) => fieldsOf(options.problemsOnLeaving(value)),
      onDynamic: ({ value }: { value: ApplyValues }) => fieldsOf(options.problems(value)),
    },
    listeners: {
      onChange: ({ fieldApi }: { fieldApi: { name: string } }) => options.changed(fieldApi.name),
    },
    onSubmit: ({ value }: { value: ApplyValues }) => options.submit(value),
  };
}

/**
 * Checks again what the form already holds errors about, against what it holds now. A submit that
 * finds a field in error stops before the form's own rules run, so an error left by another step,
 * by a field corrected without being left, or by a value the form wrote itself would hold the step
 * back for good. It runs before every submit and after the form writes a value nobody typed.
 */
export function checkAgain(form: Pick<AnyFormApi, "validate">) {
  void form.validate("blur");
  void form.validate("change");
}
