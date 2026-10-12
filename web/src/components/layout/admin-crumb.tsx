"use client";

import {
  createContext,
  use,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/** The name of the page on screen, kept where the page writes it and the bar above reads it. */
type CrumbStore = {
  get: () => string | null;
  set: (label: string | null) => void;
  subscribe: (changed: () => void) => () => void;
};

function createCrumbStore(): CrumbStore {
  let label: string | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => label,
    set(next) {
      if (next !== label) {
        label = next;
        for (const changed of listeners) changed();
      }
    },
    subscribe(changed) {
      listeners.add(changed);
      return () => listeners.delete(changed);
    },
  };
}

const CrumbContext = createContext<CrumbStore | null>(null);

/**
 * Holds the name a page below a destination gives itself, for the breadcrumb of the frame around it.
 * The frame is a layout, which is not rendered again between its pages and cannot read their records,
 * so the page hands its name up: `AdminCrumb` writes it and `useAdminCrumb` reads it.
 */
function AdminCrumbProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createCrumbStore);
  return <CrumbContext value={store}>{children}</CrumbContext>;
}

/**
 * Names the page for the breadcrumb while it is on screen. It draws nothing. Outside the admin frame,
 * where no breadcrumb is, it does nothing.
 */
function AdminCrumb({ label }: { label: string }) {
  const store = use(CrumbContext);
  // Before the paint, so the crumb arrives with the page that names it.
  useLayoutEffect(() => {
    store?.set(label);
    return () => store?.set(null);
  }, [store, label]);
  return null;
}

const noStore = () => () => {};
const noLabel = () => null;

/** The name the page on screen gave itself, or null: a destination's own page gives none. */
function useAdminCrumb() {
  const store = use(CrumbContext);
  // The server draws the bar before the page, so the name joins when the page reaches the browser.
  return useSyncExternalStore(store?.subscribe ?? noStore, store?.get ?? noLabel, noLabel);
}

export { AdminCrumb, AdminCrumbProvider, useAdminCrumb };
