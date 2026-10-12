import { defaultValidationLogic, type ValidationLogicFn } from "@tanstack/react-form";

/**
 * The validation logic every form of the application runs, around the one the form chose. It
 * changes two things in how a submit checks the fields, which it does one by one, without the
 * form's validators, before the form's own rules run.
 *
 * Each field's `onServer` entry is evaluated again, so a field with no validator of its own does
 * not keep the violation the server placed on it and block every later submit.
 *
 * A field is checked by its own rules only. For a field that has any validator, the library lists
 * every kind of rule a submit runs, with nothing to run for the kinds the field lacks, and writes
 * "no error" under each: what the form found for the field under that kind is wiped, and when
 * another field is still refused the submit stops before the form looks again. The kinds the field
 * has no rule for are left out, so the form's error stays until the form's own rules clear it. The
 * `server` kind stays in, as it is what clears a server's violation.
 */
export function clearingServerErrors(
  logic: ValidationLogicFn = defaultValidationLogic,
): ValidationLogicFn {
  return (props) =>
    logic({
      ...props,
      runValidation: ({ validators, form }) => {
        if (props.event.type !== "submit" || props.event.async) {
          return props.runValidation({ validators, form });
        }
        const own =
          props.event.fieldName === undefined
            ? validators
            : validators.filter((validator) => validator?.fn || validator?.cause === "server");
        return props.runValidation({
          validators: own.some((validator) => validator?.cause === "server")
            ? own
            : [...own, { fn: undefined, cause: "server" }],
          form,
        });
      },
    });
}
