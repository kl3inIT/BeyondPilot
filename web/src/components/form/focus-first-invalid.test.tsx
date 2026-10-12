import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";

import { focusFirstInvalid, focusFirstInvalidSoon } from "./focus-first-invalid";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** What was scrolled into view, and how. */
function scrolls() {
  const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
  return {
    elements: () => scroll.mock.contexts,
    options: () => scroll.mock.calls.map(([options]) => options),
  };
}

function prefersReducedMotion() {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
}

describe("focusFirstInvalid", () => {
  it("focuses the first control in error, in the order of the document, and brings it to the middle of the screen", () => {
    const scrolled = scrolls();
    render(
      <form aria-label="Profile">
        <input aria-label="Name" />
        <input aria-label="Email" aria-invalid="true" />
        <input aria-label="Phone" aria-invalid="true" />
      </form>,
    );

    expect(focusFirstInvalid(screen.getByRole("form"))).toBe(true);

    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(scrolled.elements()).toEqual([screen.getByLabelText("Email")]);
    expect(scrolled.options()).toEqual([{ block: "center", behavior: "smooth" }]);
  });

  it("does not animate the scroll for a person who asked for less motion", () => {
    prefersReducedMotion();
    const scrolled = scrolls();
    render(
      <form aria-label="Profile">
        <input aria-label="Email" aria-invalid="true" />
      </form>,
    );

    focusFirstInvalid(screen.getByRole("form"));

    expect(scrolled.options()).toEqual([{ block: "center", behavior: "auto" }]);
  });

  it("passes over a control in error that cannot take the focus, for the next that can", () => {
    const scrolled = scrolls();
    render(
      <form aria-label="Profile">
        <div role="radiogroup" aria-label="Topics" aria-invalid="true" />
        <input type="hidden" aria-invalid="true" />
        <input aria-label="Name" aria-invalid="true" disabled />
        <input aria-label="Email" aria-invalid="true" />
      </form>,
    );

    expect(focusFirstInvalid(screen.getByRole("form"))).toBe(true);

    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(scrolled.elements()).toEqual([screen.getByLabelText("Email")]);
  });

  it("counts a control that hands the focus to a control inside it", () => {
    const scrolled = scrolls();
    render(
      <form aria-label="Profile">
        <div role="radiogroup" aria-label="Topics" aria-invalid="true">
          <input type="radio" aria-label="Insurance" />
        </div>
        <input aria-label="Email" aria-invalid="true" />
      </form>,
    );
    const topics = screen.getByRole("radiogroup", { name: "Topics" });
    vi.spyOn(topics, "focus").mockImplementation(() => screen.getByLabelText("Insurance").focus());

    expect(focusFirstInvalid(screen.getByRole("form"))).toBe(true);

    expect(screen.getByLabelText("Insurance")).toHaveFocus();
    expect(scrolled.elements()).toEqual([topics]);
  });

  it("says so when no control in error can take the focus", () => {
    const scrolled = scrolls();
    render(
      <form aria-label="Profile">
        <input aria-label="Name" />
        <div role="radiogroup" aria-label="Topics" aria-invalid="true" />
      </form>,
    );

    expect(focusFirstInvalid(screen.getByRole("form"))).toBe(false);

    expect(document.body).toHaveFocus();
    expect(scrolled.elements()).toEqual([]);
  });

  it("says so when no control is in error", () => {
    render(
      <form aria-label="Profile">
        <input aria-label="Name" />
      </form>,
    );

    expect(focusFirstInvalid(screen.getByRole("form"))).toBe(false);
    expect(document.body).toHaveFocus();
  });

  it("does nothing without a form", () => {
    expect(focusFirstInvalid(null)).toBe(false);
  });
});

describe("focusFirstInvalidSoon", () => {
  /** Frames that run when the test says so; answers how many were asked for. */
  function frames() {
    const waiting: (() => void)[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => waiting.push(callback));
    return {
      next: () => waiting.shift()?.(),
      waiting: () => waiting.length,
    };
  }

  function Profile({ refused }: { refused: boolean }) {
    return (
      <form aria-label="Profile">
        <input aria-label="Email" aria-invalid={refused || undefined} />
      </form>
    );
  }

  it("waits for the frame after the refusal, and stops once a control took the focus", () => {
    const frame = frames();
    render(<Profile refused />);

    focusFirstInvalidSoon(() => screen.getByRole("form"));
    expect(screen.getByLabelText("Email")).not.toHaveFocus();
    frame.next();

    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(frame.waiting()).toBe(0);
  });

  it("looks again on the next frames while the refusal is not drawn yet", () => {
    const frame = frames();
    const { rerender } = render(<Profile refused={false} />);

    focusFirstInvalidSoon(() => screen.getByRole("form"));
    frame.next();
    frame.next();
    expect(screen.getByLabelText("Email")).not.toHaveFocus();
    expect(frame.waiting()).toBe(1);

    rerender(<Profile refused />);
    frame.next();
    expect(screen.getByLabelText("Email")).toHaveFocus();
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
