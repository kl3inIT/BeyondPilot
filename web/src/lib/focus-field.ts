/**
 * Moves focus to a field of a form by its id and brings it into view. The id may name a control or
 * a group of controls, such as a set of chips; a group gives focus to its first control.
 */
export function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  let control = element.matches("input, textarea, select, button")
    ? element
    : element.querySelector<HTMLElement>("button:not(:disabled), input, textarea, select");
  // A file input is drawn as the button beside it, which is what a person sees take the focus.
  if (control?.matches('input[type="file"]')) {
    control = control.parentElement?.querySelector<HTMLElement>("button:not(:disabled)") ?? control;
  }
  if (!control) {
    return;
  }
  control.focus({ preventScroll: true });
  // Centred, so neither a sticky header nor a bar fixed to the bottom covers the field or its message.
  (control.closest<HTMLElement>('[data-slot="field"]') ?? control).scrollIntoView({
    block: "center",
  });
}
