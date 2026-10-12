import "@testing-library/jest-dom/vitest";

// eslint-disable-next-line testing-library/no-manual-cleanup
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { navigation, router } from "./navigation";

// The setup of the component tests (`*.test.tsx`, vitest.config.mts): the DOM matchers, an empty
// document after each test, the router, and the browser APIs jsdom leaves out.

// Everything else of next/navigation, `redirect` and `notFound` among it, stays Next.js's own.
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  ...navigation,
}));

// Testing Library empties the document by itself only where `afterEach` is a global, which it is
// not here: the tests import what they use from vitest.
afterEach(() => {
  cleanup();
  for (const spy of Object.values(router)) {
    spy.mockClear();
  }
});

// jsdom has no layout, so it answers no media query, reports no size and scrolls nothing. These
// stand in so that a component which asks does not throw: no query matches, no size is ever
// reported, and a scroll does nothing. A test whose behaviour depends on one of them stubs its own
// with `vi.stubGlobal` or `vi.spyOn`.
window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Element.prototype.scrollIntoView = () => {};
