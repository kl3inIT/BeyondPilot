import { afterEach, describe, expect, it, vi } from "vitest";

import { focusFirstInvalid, focusFirstInvalidSoon } from "./focus-first-invalid";

// The unit tests run in Node, so the form and its controls are stood in: what is checked is what
// the helper asks of them. That the selector lists the controls in document order is the browser's.

type Control = {
  focus: ReturnType<typeof vi.fn>;
  scrollIntoView: ReturnType<typeof vi.fn>;
  contains: (other: unknown) => boolean;
  ownerDocument: { activeElement: unknown };
};

/**
 * A form whose controls in error are `kinds`, in order: one that takes the focus, one that cannot
 * (a group, a hidden input, a disabled control), or one that hands the focus to a control inside it.
 */
function standIn(...kinds: ("focusable" | "unfocusable" | "forwarding")[]) {
  const document = { activeElement: null as unknown };
  const controls = kinds.map((kind) => {
    const inner = {};
    const control: Control = {
      focus: vi.fn(() => {
        if (kind !== "unfocusable") {
          document.activeElement = kind === "forwarding" ? inner : control;
        }
      }),
      scrollIntoView: vi.fn(),
      contains: (other) => other === inner,
      ownerDocument: document,
    };
    return control;
  });
  const root = { querySelectorAll: vi.fn(() => controls) };
  return { controls, document, root: root as unknown as ParentNode };
}

function prefersReducedMotion(matches: boolean) {
  vi.stubGlobal("window", { matchMedia: () => ({ matches }) });
}

describe("focusFirstInvalid", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("focuses the control in error and brings it to the middle of the screen", () => {
    prefersReducedMotion(false);
    const { controls, root } = standIn("focusable", "focusable");

    expect(focusFirstInvalid(root)).toBe(true);
    expect(root.querySelectorAll).toHaveBeenCalledWith('[aria-invalid="true"]');
    expect(controls[0].focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(controls[0].scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      behavior: "smooth",
    });
    expect(controls[1].focus).not.toHaveBeenCalled();
  });

  it("does not animate the scroll for a person who asked for less motion", () => {
    prefersReducedMotion(true);
    const { controls, root } = standIn("focusable");

    focusFirstInvalid(root);

    expect(controls[0].scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  });

  it("passes over a control in error that cannot take the focus, for the next that can", () => {
    prefersReducedMotion(false);
    const { controls, document, root } = standIn("unfocusable", "focusable");

    expect(focusFirstInvalid(root)).toBe(true);
    expect(document.activeElement).toBe(controls[1]);
    expect(controls[0].scrollIntoView).not.toHaveBeenCalled();
    expect(controls[1].scrollIntoView).toHaveBeenCalled();
  });

  it("counts a control that hands the focus to a control inside it", () => {
    prefersReducedMotion(false);
    const { controls, root } = standIn("forwarding", "focusable");

    expect(focusFirstInvalid(root)).toBe(true);
    expect(controls[0].scrollIntoView).toHaveBeenCalled();
    expect(controls[1].focus).not.toHaveBeenCalled();
  });

  it("says so when no control in error can take the focus", () => {
    const { controls, root } = standIn("unfocusable");

    expect(focusFirstInvalid(root)).toBe(false);
    expect(controls[0].scrollIntoView).not.toHaveBeenCalled();
    expect(focusFirstInvalid(standIn().root)).toBe(false);
  });

  it("does nothing without a form", () => {
    expect(focusFirstInvalid(null)).toBe(false);
  });
});

describe("focusFirstInvalidSoon", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Frames that run when the test says so; answers how many were asked for. */
  function frames() {
    const waiting: (() => void)[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => waiting.push(callback));
    return {
      next: () => waiting.shift()?.(),
      waiting: () => waiting.length,
    };
  }

  it("waits for the frame after the refusal, and stops once a control took the focus", () => {
    prefersReducedMotion(false);
    const frame = frames();
    const { controls, root } = standIn("focusable");

    focusFirstInvalidSoon(() => root);
    expect(controls[0].focus).not.toHaveBeenCalled();
    frame.next();

    expect(controls[0].focus).toHaveBeenCalledTimes(1);
    expect(frame.waiting()).toBe(0);
  });

  it("looks again on the next frames while the refusal is not drawn yet", () => {
    prefersReducedMotion(false);
    const frame = frames();
    const drawn = standIn("focusable");
    let root: ParentNode | null = standIn().root;

    focusFirstInvalidSoon(() => root);
    frame.next();
    frame.next();
    expect(frame.waiting()).toBe(1);

    root = drawn.root;
    frame.next();
    expect(drawn.controls[0].focus).toHaveBeenCalledTimes(1);
    expect(frame.waiting()).toBe(0);
  });

  it("gives up after ten frames", () => {
    const frame = frames();
    const root = vi.fn(() => null);

    focusFirstInvalidSoon(root);
    for (let count = 0; count < 20; count += 1) {
      frame.next();
    }

    expect(root).toHaveBeenCalledTimes(10);
    expect(frame.waiting()).toBe(0);
  });
});
