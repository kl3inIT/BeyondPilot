"use client";

import { ArrowRightIcon } from "lucide-react";
import { useId } from "react";

import { TextButton } from "@/components/actions/text-button";
import { Kbd } from "@/components/ui/kbd";
import { useShortcuts } from "@/hooks/use-shortcuts";

type QueueNextProps = {
  /** Where this record stands among those that wait: "2 of 3 waiting". Absent when it does not wait. */
  position?: string;
  /** The next record that waits, if another does. */
  next: { href: string; label: string } | null;
};

/**
 * The way through a review queue from one of its records: where this one stands, and the next one
 * that waits, also under the N key.
 */
function QueueNext({ position, next }: QueueNextProps) {
  const id = useId();
  // The key follows the link itself, so a page that asks before it is left is asked here too.
  useShortcuts({
    n: next ? () => document.getElementById(id)?.click() : undefined,
  });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {position && <span className="text-sm text-muted-foreground">{position}</span>}
      {next && (
        <TextButton id={id} href={next.href}>
          {next.label}
          <ArrowRightIcon aria-hidden="true" />
          <Kbd aria-hidden="true">N</Kbd>
        </TextButton>
      )}
    </div>
  );
}

export { QueueNext };
