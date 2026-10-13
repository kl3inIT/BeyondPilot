"use client";

import { useState } from "react";

import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

type RevealProps = {
  /** Whether the content is shown. */
  open: boolean;
  /** What appears; while it closes, the last content shown stays until the space is gone. */
  children: React.ReactNode;
};

/**
 * A block that appears inside a page grows into place, and shrinks away, instead of pushing what is
 * under it at once: the shared component for a change of height (docs/conventions.md › Motion). It is
 * the registry `collapsible` without a trigger, so it moves as the collapsible sections do and not at
 * all for a person who asked for less motion. Closed, nothing of it is in the page.
 */
function Reveal({ open, children }: RevealProps) {
  // While it closes, the caller has usually dropped the content already: the last one shown is kept.
  const [shown, setShown] = useState(children);
  if (open && children !== shown) {
    setShown(children);
  }

  return (
    <Collapsible open={open}>
      <CollapsibleContent>{open ? children : shown}</CollapsibleContent>
    </Collapsible>
  );
}

export { Reveal };
