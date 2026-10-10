"use client";

import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/composites/confirm-dialog";

type LeaveGuardProps = {
  /** True while the page holds work that is not saved. */
  active: boolean;
  /** Ask on the browser's Back as well. A page that then moves on by itself replaces its entry. */
  back?: boolean;
  title: string;
  description: string;
  leaveLabel: string;
  stayLabel: string;
};

/** Where the person was going when the guard asked: an address, or one step back in the history. */
type Destination = { href: string } | "back";

/** Whether the entry the history stands on is the one a guard added to catch Back. */
function onGuardEntry() {
  return (history.state as { leaveGuard?: boolean } | null)?.leaveGuard === true;
}

/**
 * Keeps unsaved work from being lost by accident. While `active`, a link of the page that leads
 * elsewhere asks first, and so does the browser when the page is closed or reloaded. With `back`,
 * the browser's Back asks too.
 */
function LeaveGuard({ active, back, title, description, leaveLabel, stayLabel }: LeaveGuardProps) {
  const [destination, setDestination] = useState<Destination | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    function askBrowser(event: BeforeUnloadEvent) {
      if (!leaving.current) {
        event.preventDefault();
      }
    }
    function askLink(event: MouseEvent) {
      const link = (event.target as HTMLElement).closest("a[href]");
      const modified = event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey;
      if (!(link instanceof HTMLAnchorElement) || modified || link.target === "_blank") {
        return;
      }
      const url = new URL(link.href);
      if (url.protocol !== location.protocol || url.href === location.href) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setDestination({ href: url.href });
    }
    window.addEventListener("beforeunload", askBrowser);
    document.addEventListener("click", askLink, true);
    return () => {
      window.removeEventListener("beforeunload", askBrowser);
      document.removeEventListener("click", askLink, true);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !back) {
      return;
    }
    // The browser does not ask before it goes back, and by then the page is gone. So the page gets
    // a second entry of its own: Back first lands on the page itself, where the question is asked.
    // The router's own state travels with the entry, so the router sees the same page.
    const arm = () =>
      history.pushState(
        { ...(history.state as object | null), leaveGuard: true },
        "",
        location.href,
      );
    if (!onGuardEntry()) {
      arm();
    }
    function askBack() {
      if (leaving.current) {
        return;
      }
      arm();
      setDestination("back");
    }
    window.addEventListener("popstate", askBack);
    return () => window.removeEventListener("popstate", askBack);
  }, [active, back]);

  if (destination === null) {
    return null;
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={() => setDestination(null)}
      title={title}
      description={description}
      confirmLabel={leaveLabel}
      cancelLabel={stayLabel}
      tone="danger"
      pending={false}
      onConfirm={() => {
        // The person has answered here, so the browser does not ask again.
        leaving.current = true;
        if (destination === "back") {
          // Past the entry added to ask, and past the page itself.
          history.go(-2);
        } else if (onGuardEntry()) {
          location.replace(destination.href);
        } else {
          location.assign(destination.href);
        }
      }}
    />
  );
}

export { LeaveGuard, onGuardEntry };
