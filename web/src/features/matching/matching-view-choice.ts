/** The two ways to read the matched solutions. */
export const viewNames = ["one", "list"] as const;

export type ViewName = (typeof viewNames)[number];

const storageKey = "matching-view";
const listeners = new Set<() => void>();

/** The way chosen in this document, for a browser that refuses to store anything. */
let chosen: ViewName | null = null;

function stored(): ViewName | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return viewNames.find((name) => name === value) ?? null;
  } catch {
    return null;
  }
}

/** The way this person last chose to read the matched solutions, or `null` when they never chose. */
export function readViewChoice(): ViewName | null {
  return chosen ?? stored();
}

/** Keeps the choice for later visits: a convenience of this browser, which may lose it. */
export function saveViewChoice(view: ViewName) {
  chosen = view;
  try {
    window.localStorage.setItem(storageKey, view);
  } catch {
    // Private browsing or blocked site data: the choice holds for this document only.
  }
  listeners.forEach((listener) => listener());
}

/** For `useSyncExternalStore`: a choice made here, or in another tab of the same browser. */
export function subscribeViewChoice(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The way the page opens: one by one while a solution waits for a decision, unless the person chose the
 * list before; the list otherwise.
 */
export function openingView(choice: ViewName | null, waits: boolean): ViewName {
  return choice !== "list" && waits ? "one" : "list";
}
