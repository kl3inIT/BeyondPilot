import { render as renderInDocument, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { formats, timeZone } from "@/i18n/formats";

import messages from "../../messages/en.json";

type Options = Omit<RenderOptions, "wrapper"> & {
  /** The query of the page the component is on: `"?sort=-score&page=3"`. */
  searchParams?: string;
};

/**
 * Draws a component as the application would, in place of Testing Library's `render`
 * (docs/guidelines/testing.md › Component tests): inside next-intl with the English catalog, the
 * app's formats and Vietnam time, and inside nuqs with the query the test names. It answers what
 * Testing Library's `render` does, and with it:
 *
 * - `user`, a person at the keyboard and the mouse (`await user.click(…)`);
 * - `onUrlUpdate`, a spy called with each query nuqs writes
 *   (`onUrlUpdate.mock.lastCall?.[0].queryString`).
 *
 * The router is the stand-in of `@/test/navigation`.
 */
function render(ui: ReactNode, { searchParams, ...options }: Options = {}) {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  function App({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={messages} timeZone={timeZone} formats={formats}>
        {/* With memory, so a second write starts from what the first one left in the URL. */}
        <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
          {children}
        </NuqsTestingAdapter>
      </NextIntlClientProvider>
    );
  }
  return {
    user: userEvent.setup(),
    onUrlUpdate,
    ...renderInDocument(ui, { wrapper: App, ...options }),
  };
}

export { render };
