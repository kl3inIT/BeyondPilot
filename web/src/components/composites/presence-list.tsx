"use client";

import { AnimatePresence, domAnimation, LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useState } from "react";

import { baseSeconds } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A list whose items fold away when they leave and unfold when they arrive, as Dub's lists do, so
 * the rows under them slide into place instead of jumping (docs/conventions.md › Motion). Items that
 * are there when the list first draws do not move. Its children are `PresenceItem`s with a `key`.
 */
function PresenceList({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </LazyMotion>
  );
}

type PresenceItemProps = {
  className?: string;
  children: React.ReactNode;
};

/** One item of a `PresenceList`, drawn as a list item. */
function PresenceItem({ className, children }: PresenceItemProps) {
  const still = useReducedMotion() ?? false;
  // Clipped only while it folds or unfolds, so a focus ring is never cut at rest.
  const [moving, setMoving] = useState(false);

  return (
    <m.li
      className={cn(moving && "overflow-hidden", className)}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      // Dub's 150ms: the quicker step, since an operator moves through many rows.
      transition={{ duration: still ? 0 : baseSeconds * 0.75, ease: "easeOut" }}
      onAnimationStart={() => setMoving(true)}
      onAnimationComplete={() => setMoving(false)}
    >
      {children}
    </m.li>
  );
}

export { PresenceItem, PresenceList };
