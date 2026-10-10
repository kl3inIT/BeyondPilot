"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useId } from "react";

import { TextButton } from "@/components/actions/text-button";
import { Kbd } from "@/components/ui/kbd";
import { useShortcuts } from "@/hooks/use-shortcuts";

type QueueNextProps = {
  /** Where this record stands among those that wait: "2 of 3 waiting". Absent when it does not wait. */
  position?: string;
  /** The record before this one, where the queue can be walked back. */
  previous?: { href: string; label: string } | null;
  /** The next record that waits, if another does. */
  next: { href: string; label: string } | null;
  /** What to say in place of the next record when none waits any more. */
  done?: string;
};

/**
 * The way through a review queue from one of its records: where this one stands, the one before
 * under the P key, and the next one that waits under the N key.
 */
function QueueNext({ position, previous, next, done }: QueueNextProps) {
  const id = useId();
  // The keys follow the links themselves, so a page that asks before it is left is asked here too.
  useShortcuts({
    n: next ? () => document.getElementById(`${id}-next`)?.click() : undefined,
    p: previous ? () => document.getElementById(`${id}-previous`)?.click() : undefined,
  });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {previous && (
        <TextButton id={`${id}-previous`} href={previous.href}>
          <ArrowLeftIcon aria-hidden="true" />
          {previous.label}
          <Kbd aria-hidden="true">P</Kbd>
        </TextButton>
      )}
      {position && <span className="text-sm text-muted-foreground">{position}</span>}
      {next ? (
        <TextButton id={`${id}-next`} href={next.href}>
          {next.label}
          <ArrowRightIcon aria-hidden="true" />
          <Kbd aria-hidden="true">N</Kbd>
        </TextButton>
      ) : (
        done && <span className="text-sm font-medium">{done}</span>
      )}
    </div>
  );
}

export { QueueNext };
