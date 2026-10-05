"use client";

import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/composites/confirm-dialog";

type LeaveGuardProps = {
  /** True while the page holds work that is not saved. */
  active: boolean;
  title: string;
  description: string;
  leaveLabel: string;
  stayLabel: string;
};

/**
 * Keeps unsaved work from being lost by accident. While `active`, a link of the page that leads
 * elsewhere asks first, and so does the browser when the page is closed or reloaded.
 */
function LeaveGuard({ active, title, description, leaveLabel, stayLabel }: LeaveGuardProps) {
  const [destination, setDestination] = useState<string | null>(null);
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
      setDestination(url.href);
    }
    window.addEventListener("beforeunload", askBrowser);
    document.addEventListener("click", askLink, true);
    return () => {
      window.removeEventListener("beforeunload", askBrowser);
      document.removeEventListener("click", askLink, true);
    };
  }, [active]);

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
        location.assign(destination);
      }}
    />
  );
}

export { LeaveGuard };
