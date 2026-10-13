"use client";

import { useEffect, useEffectEvent, useReducer, useRef } from "react";

import { ApiError } from "@/lib/api/client";
import {
  acceptConversation,
  declineConversation,
  getConversation,
  listConversations,
  listMessages,
  markConversationRead,
  reportConversation,
  sayTyping,
  sendMessage,
  startConversation,
  type ConversationDetail,
  type ConversationList,
  type MessagingEvent,
} from "@/lib/api/generated";

import type { MessagingTarget } from "./messaging-search";
import { fromOtherSide, initialState, reduce, type EventKind } from "./messaging-state";
import { useMessagingEvents } from "./use-messaging-events";

/** How long "… is writing" stays without hearing it again. */
const TYPING_SHOWN = 5_000;

/** How often the reader's own writing is told to the other side. */
const TYPING_TOLD = 3_000;

function watchingNow() {
  return typeof document !== "undefined" && document.visibilityState === "visible";
}

/**
 * The reader's conversations as the screen holds them: the two lists, the conversation that is
 * open, and what the reader does in it. The lists and the open conversation start from what the
 * server read for the page; from then on the stream of events keeps them current, and each time the
 * stream opens the screen reads what it missed.
 *
 * `onFailure` is told of a request that failed, to say so. `onGone` is told when the open
 * conversation is no longer the reader's, as after they declined it.
 */
export function useMessaging(
  list: ConversationList,
  detail: ConversationDetail | null,
  onFailure: (error: unknown) => void,
  onGone: () => void,
) {
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(list, detail));
  /** The seq up to which the backend was told the reader has read, by conversation. */
  const told = useRef(new Map<string, number>());
  const typingTold = useRef(0);
  const typingTimer = useRef<number | undefined>(undefined);
  const selected = useRef(detail?.conversation.id ?? null);
  const thread = state.thread;
  const openId = thread?.conversation.id;

  /** Reads the lists again, and the open conversation with them. */
  async function readAgain() {
    try {
      const { data } = await listConversations();
      dispatch({ type: "listed", list: data });
      if (openId) {
        const { data: again } = await getConversation({ path: { id: openId } });
        if (selected.current === openId) {
          dispatch({ type: "opened", detail: again });
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && selected.current === openId) {
        selected.current = null;
        dispatch({ type: "closed" });
        onGone();
      }
      // Anything else is read again when the stream next opens.
    }
  }

  /** Reads what was written in the open conversation while the stream was away. */
  async function catchUp() {
    const last = thread?.messages.findLast((message) => message.seq !== null)?.seq;
    if (!openId || last == null) {
      return;
    }
    try {
      const { data } = await listMessages({ path: { id: openId }, query: { after: last } });
      dispatch({
        type: "caughtUp",
        conversationId: openId,
        messages: data.messages,
        readByOtherSide: data.readByOtherSide,
      });
    } catch {
      // The next time the stream opens tries again.
    }
  }

  const connected = useMessagingEvents(
    (kind: EventKind, event: MessagingEvent) => {
      dispatch({ type: "heard", kind, event, watching: watchingNow() });
      if (kind === "typing" && event.conversationId === openId) {
        window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(
          () => dispatch({ type: "typingEnded", conversationId: event.conversationId }),
          TYPING_SHOWN,
        );
      }
    },
    () => {
      void readAgain();
      void catchUp();
    },
  );

  // Something was heard that the screen does not hold: a new conversation, an answer, a close.
  const stale = state.stale;
  const readStale = useEffectEvent(() => void readAgain());
  useEffect(() => {
    if (stale > 0) {
      readStale();
    }
  }, [stale]);

  /** Tells the backend how far the reader has read the open conversation, once for each message. */
  const lastFromOtherSide = thread?.messages.findLast(
    (message) => message.seq !== null && fromOtherSide(thread.conversation, message),
  )?.seq;
  const markRead = useEffectEvent(() => {
    if (!openId || lastFromOtherSide == null || !watchingNow()) {
      return;
    }
    if ((told.current.get(openId) ?? 0) >= lastFromOtherSide) {
      return;
    }
    told.current.set(openId, lastFromOtherSide);
    dispatch({ type: "read", conversationId: openId });
    void markConversationRead({ path: { id: openId }, body: { seq: lastFromOtherSide } }).catch(
      () => {
        // Told again with the next message, or when the reader comes back to the screen.
        told.current.delete(openId);
      },
    );
  });
  useEffect(() => {
    markRead();
  }, [openId, lastFromOtherSide]);
  useEffect(() => {
    const onVisible = () => markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  async function deliver(conversationId: string, id: string, body: string) {
    try {
      const { data } = await sendMessage({ path: { id: conversationId }, body: { id, body } });
      dispatch({ type: "kept", conversationId, message: data });
    } catch (error) {
      dispatch({ type: "failed", id });
      onFailure(error);
    }
  }

  return {
    state,
    /** False while the stream is away: what arrives meanwhile shows when it is back. */
    connected,
    /** Shows a conversation of the list. */
    async open(id: string) {
      selected.current = id;
      try {
        const { data } = await getConversation({ path: { id } });
        if (selected.current !== id) {
          return false;
        }
        dispatch({ type: "opened", detail: data });
        return true;
      } catch (error) {
        if (selected.current === id) {
          onFailure(error);
        }
        return false;
      }
    },
    close() {
      selected.current = null;
      dispatch({ type: "closed" });
    },
    /** Writes a message: it is shown at once and kept by the backend under the identifier given here. */
    send(body: string) {
      if (!openId) {
        return;
      }
      const id = crypto.randomUUID();
      dispatch({
        type: "sending",
        conversationId: openId,
        id,
        body,
        at: new Date().toISOString(),
      });
      void deliver(openId, id, body);
    },
    /** Sends a message that did not arrive again, under the same identifier, so it is written once. */
    retry(id: string) {
      const message = thread?.messages.find((held) => held.id === id);
      if (!openId || !message) {
        return;
      }
      dispatch({
        type: "sending",
        conversationId: openId,
        id,
        body: message.body,
        at: message.createdAt,
      });
      void deliver(openId, id, message.body);
    },
    /** Tells the other side that the reader is writing, at most every few seconds. */
    typing() {
      const now = Date.now();
      if (!openId || !thread.conversation.canWrite || now - typingTold.current < TYPING_TOLD) {
        return;
      }
      typingTold.current = now;
      void sayTyping({ path: { id: openId } }).catch(() => {
        // Nothing depends on it.
      });
    },
    /** Reads the messages before the first one held. */
    async earlier() {
      const first = thread?.messages.find((message) => message.seq !== null)?.seq;
      if (!openId || first == null) {
        return;
      }
      try {
        const { data } = await listMessages({ path: { id: openId }, query: { before: first } });
        dispatch({
          type: "earlier",
          conversationId: openId,
          messages: data.messages,
          hasMore: data.hasMore,
        });
      } catch (error) {
        onFailure(error);
      }
    },
    /** Writes a first message, and shows the conversation it opened. */
    async start(target: MessagingTarget, body: string, id: string) {
      const { data } = await startConversation({
        body: { id, kind: target.kind, slug: target.slug, body },
      });
      const { data: lists } = await listConversations();
      dispatch({ type: "listed", list: lists });
      return data.conversation.id;
    },
    /** Accepts the first message that is open, which opens the conversation. */
    async accept() {
      if (!openId) {
        return;
      }
      const { data } = await acceptConversation({ path: { id: openId } });
      dispatch({ type: "opened", detail: data });
      const { data: lists } = await listConversations();
      dispatch({ type: "listed", list: lists });
    },
    /** Declines or reports the first message that is open; it is then gone for the reader. */
    async refuse(how: "decline" | "report") {
      if (!openId) {
        return;
      }
      await (how === "decline" ? declineConversation : reportConversation)({
        path: { id: openId },
      });
      selected.current = null;
      dispatch({ type: "closed" });
      const { data: lists } = await listConversations();
      dispatch({ type: "listed", list: lists });
    },
  };
}
