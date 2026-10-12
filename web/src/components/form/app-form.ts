import { createFormHook, type AnyFormApi } from "@tanstack/react-form";
import { useId } from "react";

import { focusFirstInvalidSoon } from "@/components/form/focus-first-invalid";
import { fieldContext, formContext } from "@/components/form/form-context";
import {
  CheckboxField,
  ComboboxField,
  FormError,
  SelectField,
  SubmitButton,
  TextareaField,
  TextField,
} from "@/components/form/form-fields";
import { clearingServerErrors } from "@/components/form/validation-logic";

const appForm = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextareaField, SelectField, ComboboxField, CheckboxField },
  formComponents: { SubmitButton, FormError },
});

/** The `<form>` element of a form: the one that carries `id={form.formId}`. */
const elementOf = (formApi: AnyFormApi) => () => document.getElementById(formApi.formId);

/**
 * The application's TanStack Form hook (docs/conventions.md › Stack): `form.AppField` binds the
 * shared shadcn `Field` controls and `form.AppForm` the form-level parts. A refused submission's
 * errors, set with {@link setServerErrors}, clear when the person edits the form or submits again,
 * and a field may carry a validator of its own beside the form's ({@link clearingServerErrors}).
 * The pattern is MemoryOS's.
 *
 * The form's id, React's own unless the caller names one, also starts the id of every control in
 * it (`fieldIds`), so two forms in one document never share an id.
 *
 * A submit that validation refuses moves focus to the first field in error. The form is found by
 * its id, so its element is written `<form id={form.formId}>`.
 */
export const useAppForm: typeof appForm.useAppForm = (options) => {
  const id = useId();
  return appForm.useAppForm({
    ...options,
    formId: options.formId ?? id,
    validationLogic: clearingServerErrors(options.validationLogic),
    onSubmitInvalid: (props) => {
      options.onSubmitInvalid?.(props);
      focusFirstInvalidSoon(elementOf(props.formApi));
    },
  });
};

/**
 * Fields that several forms draw the same way, bound to the part of each form that holds them:
 * `<Fields form={form} fields="content" />`.
 */
export const withFieldGroup = appForm.withFieldGroup;

/** A refused submission's errors: the message under the form and the messages on its fields. */
export type ServerErrors = {
  form?: string;
  fields: Record<string, { message: string } | undefined>;
};

/**
 * Shows a refused submission's errors on the form and moves focus to the first field they are on.
 * They go under the `onServer` key, never `onSubmit`: TanStack Form re-evaluates a key only through
 * a validator of that key, and it runs a built-in `onServer` validator on every change, blur and
 * submit, so the errors clear once the person edits the form or submits again.
 */
export function setServerErrors(formApi: AnyFormApi, errors: ServerErrors) {
  formApi.setErrorMap({ onServer: errors });
  focusFirstInvalidSoon(elementOf(formApi));
}
