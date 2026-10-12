import { createFormHookContexts } from "@tanstack/react-form";
import { createContext, useContext } from "react";

import { fieldIds } from "@/components/form/field-ids";

/** The contexts the shared field and form components read; `useAppForm` provides them. */
const contexts = createFormHookContexts();
export const { fieldContext, formContext, useFormContext } = contexts;
const { useFieldContext } = contexts;

/** Validation errors as `FieldError` lists them: zod issues and server messages alike. */
function messagesOf(errors: unknown[]) {
  return errors.map((error) =>
    typeof error === "string"
      ? { message: error }
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
        ? { message: error.message }
        : undefined,
  );
}

/**
 * True under the fields of a form that says in words that every field must be filled unless it is
 * marked Optional, in place of a star on each (`AllRequired` in form-fields.tsx provides it).
 */
export const RequiredUnlessOptional = createContext(false);

/** What a field says about having to be filled. */
export type RequiredMarks = {
  /** The field is marked Optional beside its label. */
  optional?: boolean;
  /** The field carries the red star beside its label. */
  requiredMark?: boolean;
  /**
   * Says whether the field must be filled where neither mark does: `false` for a field a form of
   * required fields names as an exception in its words, `true` for one that is required without a
   * star, such as a box that must be ticked.
   */
  required?: boolean;
};

/**
 * The bound field with whether it shows as invalid and its messages for `FieldError`. A field shows
 * its errors once touched, which submitting does for every field. Custom controls inside
 * `form.AppField` use it to set `data-invalid` on `Field` and `aria-invalid` on the control, and
 * take from `ids` the id of the control, of its hint and of its error.
 *
 * `required` is the control's `aria-required`: true for a field with the star, and for every field
 * not marked Optional in a form whose fields are all required; a control gives it the marks it
 * draws. The star itself is hidden from a screen reader, so this is what says it. The native
 * `required` is never set: it brings the browser's own message, which the forms replaced.
 *
 * `spoken` says whether the error announces itself (`role="alert"`). It does when a rule checked
 * while typing or on leaving the field set it, as nothing else tells a screen reader. What a
 * submit or the server refused is not: the focus moves to the first field in error, which is read
 * with its error, and every other error speaking at once would only be noise.
 */
export function useFieldValidity<TValue>(marks: RequiredMarks = {}) {
  const field = useFieldContext<TValue>();
  const everyField = useContext(RequiredUnlessOptional);
  const { isTouched, isValid, errors, errorMap } = field.state.meta;
  const invalid = isTouched && !isValid;
  const required = marks.required ?? (marks.requiredMark || (everyField && !marks.optional));
  return {
    field,
    invalid,
    errors: messagesOf(errors),
    ids: fieldIds(field),
    required: required || undefined,
    spoken: Boolean(errorMap.onChange || errorMap.onBlur),
  };
}
