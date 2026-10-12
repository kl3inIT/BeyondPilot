"use client";

import { createContext, useContext, useState } from "react";

import { useNotify } from "@/hooks/use-notify";

import { OrganizationReview, type OrganizationInReview } from "./organization-review";
import { nextWaiting } from "./review-queue";

/** Opens the review of one organization of the list; absent outside a list. */
const ReviewQueueContext = createContext<((id: string) => void) | null>(null);

type OrganizationReviewQueueProps = {
  /** The organizations of the list on screen that wait for review, in its order. */
  waiting: OrganizationInReview[];
  /** The list. */
  children: React.ReactNode;
};

/**
 * The review of a list's organizations as one sitting: a row opens the dialog, and each decision
 * opens the next organization that waits on the same page, until none is left. The dialog lives
 * here, above the rows, because a row leaves the list once its organization is decided.
 */
function OrganizationReviewQueue({ waiting, children }: OrganizationReviewQueueProps) {
  const notify = useNotify();
  // What the sitting started from: the list is read again after each decision, without those decided.
  const [sitting, setSitting] = useState<OrganizationInReview[]>([]);
  const [decided, setDecided] = useState<string[]>([]);
  const [current, setCurrent] = useState<OrganizationInReview | null>(null);

  function open(id: string) {
    setSitting(waiting);
    setDecided([]);
    setCurrent(waiting.find((organization) => organization.id === id) ?? null);
  }

  function next() {
    if (!current) {
      return;
    }
    const done = [...decided, current.id];
    const id = nextWaiting(
      sitting.map((organization) => organization.id),
      done,
    );
    setDecided(done);
    setCurrent(sitting.find((organization) => organization.id === id) ?? null);
    if (id === null) {
      notify.success("Admin.organizations.review.queueDone");
    }
  }

  return (
    <ReviewQueueContext value={open}>
      {children}
      {current && (
        <OrganizationReview
          key={current.id}
          organization={current}
          more={sitting.length - decided.length - 1}
          onClose={() => setCurrent(null)}
          onDecided={next}
        />
      )}
    </ReviewQueueContext>
  );
}

/** How a row opens the review of its organization in the list's sitting; null outside a list. */
function useReviewQueue() {
  return useContext(ReviewQueueContext);
}

export { OrganizationReviewQueue, useReviewQueue };
