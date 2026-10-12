import { fieldIdOf } from "@/components/form/field-ids";

/** What can take the focus inside a field: its control, not the hidden input a control keeps. */
const controls = [
  '[role="radio"]',
  '[role="checkbox"]',
  "button:not(:disabled)",
  "select",
  "textarea",
  'input:not([type="file"]):not([type="hidden"]):not([aria-hidden="true"]):not([tabindex="-1"])',
].join(", ");

/**
 * The control a person fills the field `name` in with, once its step is on the screen. A shared
 * control carries the form's id for the field; the deck and the questions answered by a file, a
 * tick or several choices are named by hand. Where that id is a group or a hidden file input, the
 * first control of its field is the one: the first choice, or the button that opens the upload.
 */
export function controlOf(form: { formId: string }, name: string): HTMLElement | null {
  const question = name.startsWith("application.answers.")
    ? `question-${name.slice("application.answers.".length)}`
    : null;
  const named =
    document.getElementById(fieldIdOf(form, name)) ??
    document.getElementById(name === "application.deck" ? "deck" : (question ?? ""));
  if (!named) {
    return null;
  }
  if (named.matches(controls)) {
    return named;
  }
  const field = named.closest('[data-slot="field"], [data-slot="field-set"]') ?? named;
  return field.querySelector<HTMLElement>(controls);
}

/** Gives the focus to the control of the field `name` and brings it to the middle of the screen. */
export function focusField(form: { formId: string }, name: string): boolean {
  const control = controlOf(form, name);
  if (!control) {
    return false;
  }
  // Focus alone would scroll the control to the nearest edge, under the bar of steps.
  control.focus({ preventScroll: true });
  control.scrollIntoView({
    block: "center",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
  return true;
}
