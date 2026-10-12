"use client";

import { createContext, use, useState } from "react";

import { Button } from "@/components/actions/button";

const Selecting = createContext<{ selecting: boolean; setCount: (count: number) => void }>({
  selecting: false,
  setCount: () => {},
});

/**
 * The frame of the applications page, which also holds whether any application is selected: the
 * table knows, and the page's own leading action above it gives way. A screen has one primary
 * action, and while rows are selected it is the selection bar's.
 */
function ReviewSelection(props: React.ComponentProps<"div">) {
  const [count, setCount] = useState(0);
  return (
    <Selecting value={{ selecting: count > 0, setCount }}>
      <div {...props} />
    </Selecting>
  );
}

/** Tells the page how many applications are selected; the table hands it to `DataTableView`. */
function useSelectionCount() {
  return use(Selecting).setCount;
}

/** The page's leading action: primary, and secondary while the selection bar holds the primary. */
function PageLeadingAction({ href, children }: { href: string; children: React.ReactNode }) {
  const { selecting } = use(Selecting);
  return (
    <Button prominence={selecting ? "secondary" : "primary"} href={href}>
      {children}
    </Button>
  );
}

export { PageLeadingAction, ReviewSelection, useSelectionCount };
