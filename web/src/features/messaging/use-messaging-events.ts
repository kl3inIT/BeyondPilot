"use client";

import { useEffect, useEffectEvent, useState } from "react";

import type { MessagingEvent } from "@/lib/api/generated";

import { eventKinds, type EventKind } from "./messaging-state";

/** How long to wait before asking for the stream again when it was refused, at first and at most. */
const RETRY = { first: 2_000, longest: 30_000 };

function bodyOf(event: MessageEvent<string>): MessagingEvent | undefined {
  try {
    const body: unknown = JSON.parse(event.data);
    return typeof body === "object" &&
      body !== null &&
      "conversationId" in body &&
      typeof body.conversationId === "string"
      ? (body as MessagingEvent)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Listens to what happens in the reader's conversations for as long as the screen is there
 * (`streamMessagingEvents`). An event carries what happened, so the screen shows it without asking
 * again. Nothing is replayed: `onOpen` runs each time the stream opens, and the screen then reads
 * what it missed.
 *
 * The backend ends the stream every ten minutes and the browser opens it again by itself; a stream
 * that was refused, as a proxy refuses it while the backend restarts, is asked for again after a
 * while.
 *
 * Answers false once the stream was lost or refused, until it is open again. A stream that is
 * still opening, or that this browser cannot ask for, was not lost: nothing is said of it.
 */
export function useMessagingEvents(
  onEvent: (kind: EventKind, event: MessagingEvent) => void,
  onOpen: () => void,
) {
  const [lost, setLost] = useState(false);
  const hear = useEffectEvent(onEvent);
  const opened = useEffectEvent(onOpen);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }
    let gone = false;
    let source: EventSource | undefined;
    let retryTimer: number | undefined;
    let wait = RETRY.first;

    const listen = () => {
      const stream = new EventSource("/api/messaging/events");
      source = stream;
      stream.addEventListener("open", () => {
        wait = RETRY.first;
        setLost(false);
        opened();
      });
      stream.addEventListener("error", () => {
        setLost(true);
        // The browser gives up on a stream that was answered with a failure.
        if (stream.readyState === EventSource.CLOSED && !gone) {
          retryTimer = window.setTimeout(listen, wait);
          wait = Math.min(wait * 2, RETRY.longest);
        }
      });
      for (const kind of eventKinds) {
        stream.addEventListener(kind, (event: MessageEvent<string>) => {
          const body = bodyOf(event);
          if (body) {
            hear(kind, body);
          }
        });
      }
    };
    listen();

    return () => {
      gone = true;
      window.clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  return !lost;
}
