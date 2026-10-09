"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { getMatching, type Matching } from "@/lib/api/generated";

/** What the backend names a change (`streamMatchingChanges`). */
const kinds = ["run", "brief", "found", "reading", "read", "decision"] as const;

/** Changes that arrive within this many milliseconds are answered by one read of the state. */
const TOGETHER = 150;

/** How long to wait before asking for the stream again when it was refused, at first and at most. */
const RETRY = { first: 5_000, longest: 60_000 };

/** What the stream of one use case says now. */
type Heard = { useCaseId: string; open: boolean; reading: string[] };

function solutionOf(event: MessageEvent<string>): string | undefined {
  try {
    const body: unknown = JSON.parse(event.data);
    return typeof body === "object" &&
      body !== null &&
      "solutionId" in body &&
      typeof body.solutionId === "string"
      ? body.solutionId
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Listens to what changes in the matching of a use case for as long as the screen is there. A change
 * says only that something is different, so the state is read again, once for the changes that arrive
 * together, and given to `onRead`; an answer that a newer read or `supersede` overtook is dropped. The
 * stream also says which solutions the AI is reading at this moment, which no read holds.
 *
 * `open` is false until the stream is open and whenever it is lost: the screen then keeps itself
 * current another way. The browser reconnects a stream that drops; one that was refused is asked for
 * again after a while. Each time it opens the state is read once, since nothing is replayed.
 */
export function useMatchingChanges(useCaseId: string, onRead: (state: Matching) => void) {
  const [heard, setHeard] = useState<Heard>({ useCaseId, open: false, reading: [] });
  /** The number of the newest read; an answer with an older one is not shown. */
  const newest = useRef(0);
  const show = useEffectEvent(onRead);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }
    let gone = false;
    let source: EventSource | undefined;
    let readTimer: number | undefined;
    let retryTimer: number | undefined;
    let wait = RETRY.first;

    /** What is heard of this use case; what was heard of another one is forgotten. */
    const hear = (change: (reading: string[]) => { open: boolean; reading: string[] }) =>
      setHeard((current) => ({
        useCaseId,
        ...change(current.useCaseId === useCaseId ? current.reading : []),
      }));

    const read = async () => {
      readTimer = undefined;
      const mine = ++newest.current;
      try {
        const { data } = await getMatching({ path: { useCaseId } });
        if (!gone && mine === newest.current) {
          show(data);
        }
      } catch {
        // The next change reads again, and so does the reload that runs while the stream is not open.
      }
    };
    const readSoon = () => {
      readTimer ??= window.setTimeout(() => void read(), TOGETHER);
    };

    const listen = () => {
      const stream = new EventSource(`/api/matching/use-cases/${useCaseId}/events`);
      source = stream;
      stream.addEventListener("open", () => {
        wait = RETRY.first;
        hear(() => ({ open: true, reading: [] }));
        readSoon();
      });
      stream.addEventListener("error", () => {
        hear(() => ({ open: false, reading: [] }));
        // The browser gives up on a stream that was answered with a failure, as a proxy answers while
        // the backend restarts.
        if (stream.readyState === EventSource.CLOSED && !gone) {
          retryTimer = window.setTimeout(listen, wait);
          wait = Math.min(wait * 2, RETRY.longest);
        }
      });
      for (const kind of kinds) {
        stream.addEventListener(kind, (event: MessageEvent<string>) => {
          const solutionId = solutionOf(event);
          if (kind === "reading" && solutionId) {
            hear((ids) => ({
              open: true,
              reading: ids.includes(solutionId) ? ids : [...ids, solutionId],
            }));
          } else if (kind === "read" && solutionId) {
            hear((ids) => ({ open: true, reading: ids.filter((id) => id !== solutionId) }));
          } else if (kind === "run") {
            // A run that starts, stops or ends is reading nothing at that moment.
            hear(() => ({ open: true, reading: [] }));
          }
          readSoon();
        });
      }
    };
    listen();

    return () => {
      gone = true;
      window.clearTimeout(readTimer);
      window.clearTimeout(retryTimer);
      source?.close();
    };
  }, [useCaseId]);

  const mine = heard.useCaseId === useCaseId;
  return {
    open: mine && heard.open,
    /** The solutions whose judgment is under way, by their identifier. */
    reading: mine ? heard.reading : [],
    /** Drops the read under way: what the screen was just given is newer. */
    supersede: () => {
      newest.current += 1;
    },
  };
}
