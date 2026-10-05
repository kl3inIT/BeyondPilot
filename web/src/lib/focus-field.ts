/**
 * Moves focus to a field of a form by its id, which brings it into view. The id may name a control
 * or a group of controls, such as a set of chips; a group gives focus to its first control.
 */
export function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  const control = element.matches("input, textarea, select, button")
    ? element
    : element.querySelector<HTMLElement>("button:not(:disabled), input, textarea, select");
  control?.focus();
}
