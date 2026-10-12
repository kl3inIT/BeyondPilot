/** What a visitor answered when asked whether Google Analytics may measure their visit. */
type AnalyticsConsent = "granted" | "denied";

const storageKey = "analytics-consent";
const listeners = new Set<() => void>();

/** The answer given in this document, for a browser that refuses to store anything. */
let answered: AnalyticsConsent | null = null;

function stored(): AnalyticsConsent | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Removes the cookies Google Analytics keeps (`_ga` and one `_ga_…` per stream), which it sets on
 * the widest domain it can, so a visitor who takes their consent back is no longer recognised.
 */
function clearAnalyticsCookies() {
  const names = document.cookie
    .split("; ")
    .map((cookie) => cookie.split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
  const host = window.location.hostname;

  for (const name of names) {
    for (const scope of ["", `; domain=${host}`, `; domain=.${host}`]) {
      document.cookie = `${name}=; Max-Age=0; path=/${scope}`;
    }
  }
}

/** The visitor's answer, or `null` while they have not been asked. */
function readConsent(): AnalyticsConsent | null {
  return answered ?? stored();
}

/** Keeps the answer for later visits and tells every reader in this document. */
function saveConsent(consent: AnalyticsConsent) {
  answered = consent;
  try {
    window.localStorage.setItem(storageKey, consent);
  } catch {
    // Private browsing or blocked site data: the answer holds for this document only.
  }
  if (consent === "denied") {
    clearAnalyticsCookies();
  }
  listeners.forEach((listener) => listener());
}

/** For `useSyncExternalStore`: an answer given here, or in another tab of the same browser. */
function subscribeConsent(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export { readConsent, saveConsent, subscribeConsent };
