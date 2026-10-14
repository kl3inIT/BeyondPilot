"use client";

import { useEffect, useEffectEvent, useReducer, useRef } from "react";

import { ApiError } from "@/lib/api/client";
import {
  acceptConversation,
  addConversationMember,
  declineConversation,
  getConversation,
  listConversations,
  listMessages,
  markConversationRead,
  removeConversationMember,
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
  /** The conversation that is open when an answer arrives, which may be after the reader moved on. */
  const shown = useRef<string | null>(detail?.conversation.id ?? null);
  /** Counts what the reader asked to see, so that of two answers the one asked for last is shown. */
  const asked = useRef(0);
  const thread = state.thread;
  const openId = thread?.conversation.id;
  const accepted = thread?.conversation.status === "accepted";

  useEffect(() => {
    shown.current = openId ?? null;
  }, [openId]);

  /** Reads the lists again, and the open conversation with them. */
  async function readAgain() {
    const id = openId;
    try {
      const { data } = await listConversations();
      dispatch({ type: "listed", list: data, watching: watchingNow() });
    } catch {
      // Read again when the stream next opens.
    }
    if (!id) {
      return;
    }
    try {
      const { data } = await getConversation({ path: { id } });
      // The reducer leaves it out when the reader has opened another conversation meanwhile.
      dispatch({ type: "refreshed", detail: data });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && shown.current === id) {
        asked.current += 1;
        shown.current = null;
        dispatch({ type: "closed" });
        onGone();
      }
      // Anything else is read again when the stream next opens.
    }
  }

  /** Reads what was written in the open conversation while the stream was away, to its end. */
  async function catchUp() {
    let after = thread?.messages.findLast((message) => message.seq !== null)?.seq;
    if (!openId || after == null) {
      return;
    }
    try {
      for (;;) {
        const { data } = await listMessages({ path: { id: openId }, query: { after } });
        dispatch({
          type: "caughtUp",
          conversationId: openId,
          messages: data.messages,
          readByOtherSide: data.readByOtherSide,
        });
        const last = Math.max(...data.messages.map((message) => message.seq));
        // An answer that does not move forward ends the reading, whatever it says of more.
        if (!data.hasMore || last <= after) {
          return;
        }
        after = last;
      }
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

  /**
   * Tells the backend how far the reader has read the open conversation, once for each message.
   * Only a conversation that was accepted is read this way: whoever wrote a first message does not
   * learn that it was read before it is answered.
   */
  const lastFromOtherSide = thread?.messages.findLast(
    (message) => message.seq !== null && fromOtherSide(thread.conversation, message),
  )?.seq;
  const markRead = useEffectEvent(() => {
    if (!openId || !accepted || lastFromOtherSide == null || !watchingNow()) {
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
  }, [openId, accepted, lastFromOtherSide]);
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
    /** False once the stream was lost or refused: what arrives meanwhile shows when it is back. */
    connected,
    /**
     * Shows a conversation. Of two that were asked for one after the other, the one asked for last
     * is shown whichever answers first; the other is `superseded`.
     */
    async open(id: string): Promise<"opened" | "failed" | "superseded"> {
      asked.current += 1;
      const turn = asked.current;
      try {
        const { data } = await getConversation({ path: { id } });
        if (turn !== asked.current) {
          return "superseded";
        }
        shown.current = id;
        dispatch({ type: "opened", detail: data });
        return "opened";
      } catch (error) {
        if (turn !== asked.current) {
          return "superseded";
        }
        onFailure(error);
        return "failed";
      }
    },
    close() {
      asked.current += 1;
      shown.current = null;
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
      asked.current += 1;
      shown.current = data.conversation.id;
      dispatch({ type: "opened", detail: data });
      const { data: lists } = await listConversations();
      dispatch({ type: "listed", list: lists, watching: watchingNow() });
      return data.conversation.id;
    },
    /** Accepts the first message that is open, which opens the conversation. */
    async accept() {
      if (!openId) {
        return;
      }
      const { data } = await acceptConversation({ path: { id: openId } });
      dispatch({ type: "refreshed", detail: data });
      const { data: lists } = await listConversations();
      dispatch({ type: "listed", list: lists, watching: watchingNow() });
    },
    async changeMember(accountId: string, include: boolean) {
      if (!openId) return;
      const { data } = await (include ? addConversationMember : removeConversationMember)({
        path: { id: openId, accountId },
      });
      dispatch({ type: "refreshed", detail: data });
    },
    /**
     * Declines or reports the first message that is open; it is then gone for the reader. The
     * conversation closes together with the list that no longer holds it, so the screen never
     * shows the list with a row that is about to leave. True when it closed what is shown; false
     * when the reader had gone to another conversation meanwhile, which stays.
     */
    async refuse(how: "decline" | "report") {
      if (!openId) {
        return false;
      }
      const refused = openId;
      await (how === "decline" ? declineConversation : reportConversation)({
        path: { id: refused },
      });
      try {
        const { data: lists } = await listConversations();
        dispatch({ type: "listed", list: lists, watching: watchingNow() });
      } finally {
        if (shown.current === refused) {
          asked.current += 1;
          shown.current = null;
          dispatch({ type: "closed" });
        }
      }
      return shown.current === null;
    },
  };
}
