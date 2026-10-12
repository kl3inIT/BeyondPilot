"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { scrollEdges } from "@/components/composites/table-scroll-edges";
import { cn } from "@/lib/utils";

type TableScrollProps = {
  /** The name of the table, which the region takes while it scrolls; without one it says it is a table. */
  label?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * The frame of every table: a table stays a table at every width and scrolls sideways when it does
 * not fit, as the registry `table`, Dub and Medusa do. While something is hidden the frame is a
 * named region that the keyboard reaches and scrolls, and the side that hides it is shaded. The
 * frame itself scrolls, not the registry's container inside it, so that there is one scroll to name.
 */
function TableScroll({ label, className, children }: TableScrollProps) {
  const t = useTranslations("Lists.table");
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const element = scroller.current;
    if (!element) {
      return;
    }
    function read() {
      if (!element) {
        return;
      }
      const next = scrollEdges(element.scrollLeft, element.clientWidth, element.scrollWidth);
      setEdges((now) => (now.start === next.start && now.end === next.end ? now : next));
    }
    // The observer reports once when it starts, then whenever the frame or the table changes width.
    const observer = new ResizeObserver(read);
    observer.observe(element);
    if (element.firstElementChild) {
      observer.observe(element.firstElementChild);
    }
    element.addEventListener("scroll", read, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", read);
    };
  }, []);

  const scrolls = edges.start || edges.end;
  return (
    <div
      data-slot="data-table"
      data-more-end={edges.end || undefined}
      className={cn("relative overflow-hidden rounded-lg border", className)}
    >
      <div
        ref={scroller}
        data-slot="data-table-scroll"
        role={scrolls ? "region" : undefined}
        aria-label={scrolls ? (label ?? t("scroll")) : undefined}
        tabIndex={scrolls ? 0 : undefined}
        className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&>[data-slot=table-container]]:overflow-visible"
      >
        {children}
      </div>
      {edges.start && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r from-foreground/10 to-transparent"
        />
      )}
      {edges.end && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l from-foreground/10 to-transparent"
        />
      )}
    </div>
  );
}

export { TableScroll };
