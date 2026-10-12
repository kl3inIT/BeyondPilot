import { afterEach, describe, expect, it, vi } from "vitest";

import { focusFirstInvalid } from "./focus-first-invalid";

// The unit tests run in Node, so the form and its control are stood in: what is checked is what the
// helper asks of them. That the selector finds the first control in document order is the browser's.
function standIn(found: boolean) {
  const control = { focus: vi.fn(), scrollIntoView: vi.fn() };
  const root = { querySelector: vi.fn(() => (found ? control : null)) };
  return { control, root: root as unknown as ParentNode };
}

function prefersReducedMotion(matches: boolean) {
  vi.stubGlobal("window", { matchMedia: () => ({ matches }) });
}

describe("focusFirstInvalid", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("focuses the control in error and brings it to the middle of the screen", () => {
    prefersReducedMotion(false);
    const { control, root } = standIn(true);

    expect(focusFirstInvalid(root)).toBe(true);
    expect(root.querySelector).toHaveBeenCalledWith('[aria-invalid="true"]');
    expect(control.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(control.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
  });

  it("does not animate the scroll for a person who asked for less motion", () => {
    prefersReducedMotion(true);
    const { control, root } = standIn(true);

    focusFirstInvalid(root);

    expect(control.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  });

  it("leaves focus alone when no control is in error", () => {
    const { control, root } = standIn(false);

    expect(focusFirstInvalid(root)).toBe(false);
    expect(control.focus).not.toHaveBeenCalled();
  });

  it("does nothing without a form", () => {
    expect(focusFirstInvalid(null)).toBe(false);
  });
});
