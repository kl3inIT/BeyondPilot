import { describe, expect, it } from "vitest";

import type { Conversation, ConversationDetail, Message } from "@/lib/api/generated";

import { initialState, reduce, unreadOf, type MessagingState } from "./messaging-state";

function chat(id: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    id,
    kind: "talent",
    status: "accepted",
    side: "starter",
    counterpartName: `Person ${id}`,
    subjectName: `Person ${id}`,
    lastMessage: { preview: "Hello.", mine: true },
    lastMessageAt: "2026-10-12T02:00:00Z",
    unread: 0,
    canAnswer: false,
    canWrite: true,
    createdAt: "2026-10-10T02:00:00Z",
    ...overrides,
  };
}

function message(id: string, seq: number, overrides: Partial<Message> = {}): Message {
  return {
    id,
    seq,
    body: `Message ${seq}`,
    createdAt: "2026-10-13T02:00:00Z",
    mine: false,
    fromStarter: false,
    senderName: "Mei Tan",
    ...overrides,
  };
}

function detail(conversation: Conversation, messages: Message[]): ConversationDetail {
  return {
    conversation,
    messages,
    hasEarlier: false,
    readByOtherSide: 0,
    subject: {
      kind: "talent",
      name: conversation.subjectName,
      industries: [],
      roles: [],
      skills: [],
      customerDeployments: 0,
    },
    participants: [],
  };
}

function stateWith(open: Conversation | null, ...others: Conversation[]): MessagingState {
  const chats = open ? [open, ...others] : others;
  return initialState(
    { chats, requests: [], unread: 0 },
    open ? detail(open, [message("m1", 1, { mine: true, fromStarter: true })]) : null,
  );
}

describe("a message that is heard", () => {
  it("moves its conversation to the top and counts as unread when nobody is looking", () => {
    const state = stateWith(null, chat("a"), chat("b"));

    const next = reduce(state, {
      type: "heard",
      kind: "message",
      watching: false,
      event: { conversationId: "b", message: message("m2", 2) },
    });

    expect(next.chats.map((row) => row.id)).toEqual(["b", "a"]);
    expect(next.chats[0].unread).toBe(1);
    expect(next.chats[0].lastMessage).toEqual({
      preview: "Message 2",
      mine: false,
      senderName: "Mei Tan",
    });
    expect(unreadOf(next)).toBe(1);
  });

  it("is read at once in the conversation the reader is looking at", () => {
    const state = stateWith(chat("a"), chat("b"));

    const next = reduce(state, {
      type: "heard",
      kind: "message",
      watching: true,
      event: { conversationId: "a", message: message("m2", 2) },
    });

    expect(next.chats[0].unread).toBe(0);
    expect(next.thread?.messages.map((held) => held.id)).toEqual(["m1", "m2"]);
  });

  it("counts in the open conversation while the reader is away from the screen", () => {
    const state = stateWith(chat("a"));

    const next = reduce(state, {
      type: "heard",
      kind: "message",
      watching: false,
      event: { conversationId: "a", message: message("m2", 2) },
    });

    expect(next.chats[0].unread).toBe(1);
  });

  it("does not count when a colleague of the reader's own side wrote it", () => {
    const state = stateWith(null, chat("a", { side: "recipient", kind: "solution" }));

    const next = reduce(state, {
      type: "heard",
      kind: "message",
      watching: false,
      event: { conversationId: "a", message: message("m2", 2, { fromStarter: false }) },
    });

    expect(next.chats[0].unread).toBe(0);
  });

  it("asks for the list again when its conversation is not in it", () => {
    const state = stateWith(null, chat("a"));

    const next = reduce(state, {
      type: "heard",
      kind: "message",
      watching: false,
      event: { conversationId: "new", message: message("m2", 2) },
    });

    expect(next.stale).toBe(state.stale + 1);
    expect(next.chats).toBe(state.chats);
  });
});

describe("a message the reader sends", () => {
  it("is shown at once, last, and takes its place when the backend has kept it", () => {
    const state = stateWith(chat("a"));

    const sending = reduce(state, {
      type: "sending",
      conversationId: "a",
      id: "mine",
      body: "On my way.",
      at: "2026-10-13T03:00:00Z",
    });
    expect(sending.thread?.messages.at(-1)).toMatchObject({ id: "mine", delivery: "sending" });
    expect(sending.chats[0].lastMessage?.preview).toBe("On my way.");

    // The other side answers before the backend has confirmed the reader's message.
    const answered = reduce(sending, {
      type: "heard",
      kind: "message",
      watching: true,
      event: { conversationId: "a", message: message("m3", 3) },
    });
    expect(answered.thread?.messages.map((held) => held.id)).toEqual(["m1", "m3", "mine"]);

    const kept = reduce(answered, {
      type: "kept",
      conversationId: "a",
      message: message("mine", 2, { mine: true, fromStarter: true, body: "On my way." }),
    });
    expect(kept.thread?.messages.map((held) => held.id)).toEqual(["m1", "mine", "m3"]);
    expect(kept.thread?.messages[1].delivery).toBe("kept");
  });

  it("is heard on the stream and answered by the backend, and shown once", () => {
    const state = stateWith(chat("a"));
    const mine = message("mine", 2, { mine: true, fromStarter: true });
    const sending = reduce(state, {
      type: "sending",
      conversationId: "a",
      id: "mine",
      body: mine.body,
      at: mine.createdAt,
    });

    const heard = reduce(sending, {
      type: "heard",
      kind: "message",
      watching: true,
      event: { conversationId: "a", message: mine },
    });
    const kept = reduce(heard, { type: "kept", conversationId: "a", message: mine });

    expect(kept.thread?.messages.map((held) => held.id)).toEqual(["m1", "mine"]);
  });

  it("says so when it did not arrive", () => {
    const state = stateWith(chat("a"));
    const sending = reduce(state, {
      type: "sending",
      conversationId: "a",
      id: "mine",
      body: "Hello?",
      at: "2026-10-13T03:00:00Z",
    });

    const failed = reduce(sending, { type: "failed", id: "mine" });

    expect(failed.thread?.messages.at(-1)?.delivery).toBe("failed");
  });
});

describe("what the other side does", () => {
  it("shows how far they have read, and never less than before", () => {
    const state = stateWith(chat("a"));

    const read = reduce(state, {
      type: "heard",
      kind: "read",
      watching: true,
      event: { conversationId: "a", seq: 5, fromStarter: false, mine: false },
    });
    const earlier = reduce(read, {
      type: "heard",
      kind: "read",
      watching: true,
      event: { conversationId: "a", seq: 3, fromStarter: false, mine: false },
    });

    expect(earlier.thread?.readByOtherSide).toBe(5);
  });

  it("clears the reader's own count when they read on another screen", () => {
    const state = stateWith(null, chat("a", { unread: 4 }));

    const next = reduce(state, {
      type: "heard",
      kind: "read",
      watching: false,
      event: { conversationId: "a", seq: 9, fromStarter: true, mine: true },
    });

    expect(next.chats[0].unread).toBe(0);
  });

  it("shows that they are writing until their message arrives", () => {
    const state = stateWith(chat("a"));

    const typing = reduce(state, {
      type: "heard",
      kind: "typing",
      watching: true,
      event: { conversationId: "a", fromStarter: false, name: "Mei Tan" },
    });
    expect(typing.thread?.typing).toBe("Mei Tan");

    const arrived = reduce(typing, {
      type: "heard",
      kind: "message",
      watching: true,
      event: { conversationId: "a", message: message("m2", 2) },
    });
    expect(arrived.thread?.typing).toBeNull();
  });
});
