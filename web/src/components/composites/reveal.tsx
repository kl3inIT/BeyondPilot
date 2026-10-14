"use client";

import { AnimatePresence, domAnimation, LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, useState } from "react";

import { baseSeconds, entranceEase } from "@/lib/motion";

type RevealProps = {
  /** Whether the content is shown. */
  open: boolean;
  /** What appears. While it closes, the last content shown stays until the space is gone. */
  children: React.ReactNode;
};

/**
 * A block that appears inside a page grows into place, follows its content when that grows or
 * shrinks, and shrinks away, instead of pushing what is under it at once: the shared component for
 * a change of height (docs/conventions.md › Motion). A person who asked for less motion sees the
 * change at once. Closed, nothing of it is in the page.
 */
function Reveal({ open, children }: RevealProps) {
  const still = useReducedMotion() ?? false;
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  // The frame follows the content's measured height, so a longer message grows it too.
  useEffect(() => {
    const element = content.current;
    if (!open || !element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    observer.observe(element);
    return () => {
      observer.disconnect();
      // The next opening starts from the content's own height, not from this one's.
      setHeight("auto");
    };
  }, [open]);

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="reveal"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height, opacity: 1 }}
            // Leaving is quicker than arriving.
            exit={{
              height: 0,
              opacity: 0,
              transition: { duration: still ? 0 : baseSeconds * 0.75 },
            }}
            transition={{ duration: still ? 0 : baseSeconds, ease: entranceEase }}
          >
            <div ref={content}>{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}

export { Reveal };
