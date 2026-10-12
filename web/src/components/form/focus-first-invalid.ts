/**
 * Moves focus to the first control in error inside `root`, in document order, and brings it to the
 * middle of the screen: after a refused submit the person lands on what to correct. A control in
 * error is one that says so with `aria-invalid="true"`. Says whether there was one.
 */
export function focusFirstInvalid(root: ParentNode | null | undefined): boolean {
  const control = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!control) {
    return false;
  }
  // Focus alone would scroll the control to the nearest edge, under a sticky bar.
  control.focus({ preventScroll: true });
  control.scrollIntoView({
    block: "center",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
  return true;
}

/**
 * {@link focusFirstInvalid} once the refusal is on the screen: the errors reach the form's state
 * before React has drawn them, so the search waits for the next frame.
 */
export function focusFirstInvalidSoon(root: () => ParentNode | null | undefined) {
  requestAnimationFrame(() => focusFirstInvalid(root()));
}
