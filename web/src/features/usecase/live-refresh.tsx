"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const everyMilliseconds = 5000;

/**
 * Keeps the page that shows a use case's status current: while the tab is visible it asks the server for the
 * page again every few seconds, and at once when the person comes back to the tab, so a decision or an edit by
 * someone else shows without a reload. What the person typed or opened on the page stays as it is.
 */
function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const timer = window.setInterval(refresh, everyMilliseconds);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return null;
}

export { LiveRefresh };
