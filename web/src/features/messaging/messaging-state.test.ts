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

describe("the open conversation read again", () => {
  const mine = { mine: true, fromStarter: true };

  it("keeps the earlier messages the reader asked for, and what is known of those before them", () => {
    const open = chat("a");
    const latest = [message("m5", 5), message("m6", 6)];
    const state = reduce(
      initialState({ chats: [open], requests: [], unread: 0 }, detail(open, latest)),
      {
        type: "earlier",
        conversationId: "a",
        messages: [message("m3", 3), message("m4", 4)],
        hasMore: true,
      },
    );

    // The read holds the latest messages only, and says that some come before them.
    const next = reduce(state, {
      type: "refreshed",
      detail: { ...detail(open, [...latest, message("m7", 7)]), hasEarlier: false },
    });

    expect(next.thread?.messages.map((held) => held.id)).toEqual(["m3", "m4", "m5", "m6", "m7"]);
    expect(next.thread?.hasEarlier).toBe(true);
  });

  it("takes what the read says of earlier messages when the screen holds none before it", () => {
    const open = chat("a");
    const state = initialState(
      { chats: [open], requests: [], unread: 0 },
      detail(open, [message("m5", 5)]),
    );

    const next = reduce(state, {
      type: "refreshed",
      detail: { ...detail(open, [message("m4", 4), message("m5", 5)]), hasEarlier: true },
    });

    expect(next.thread?.hasEarlier).toBe(true);
  });

  it("keeps a message that was heard after the read was taken", () => {
    const state = reduce(stateWith(chat("a")), {
      type: "heard",
      kind: "message",
      watching: true,
      event: { conversationId: "a", message: message("m2", 2) },
    });

    const next = reduce(state, {
      type: "refreshed",
      detail: detail(chat("a"), [message("m1", 1, mine)]),
    });

    expect(next.thread?.messages.map((held) => held.id)).toEqual(["m1", "m2"]);
  });

  it("keeps a message the backend has not kept yet, last", () => {
    const state = reduce(stateWith(chat("a")), {
      type: "sending",
      conversationId: "a",
      id: "unsent",
      body: "On my way.",
      at: "2026-10-13T03:00:00Z",
    });

    const next = reduce(state, {
      type: "refreshed",
      detail: detail(chat("a"), [message("m1", 1, mine), message("m2", 2)]),
    });

    expect(next.thread?.messages.map((held) => held.id)).toEqual(["m1", "m2", "unsent"]);
    expect(next.thread?.messages.at(-1)?.delivery).toBe("sending");
  });

  it("takes the conversation as it is now, and never moves back how far the other side has read", () => {
    const waiting = chat("a", { status: "pending", canWrite: false });
    const state = reduce(stateWith(waiting), {
      type: "heard",
      kind: "read",
      watching: true,
      event: { conversationId: "a", seq: 5, fromStarter: false, mine: false },
    });

    const next = reduce(state, {
      type: "refreshed",
      detail: { ...detail(chat("a"), [message("m1", 1, mine)]), readByOtherSide: 1 },
    });

    expect(next.thread?.conversation).toMatchObject({ status: "accepted", canWrite: true });
    expect(next.thread?.readByOtherSide).toBe(5);
  });

  it("changes nothing when the reader has opened another conversation meanwhile", () => {
    const state = stateWith(chat("a"), chat("b"));
    const late = detail(chat("b"), [message("m9", 9)]);

    expect(reduce(state, { type: "refreshed", detail: late })).toBe(state);
    // Nothing is open: an answer does not open what the reader closed.
    const closed = reduce(state, { type: "closed" });
    expect(reduce(closed, { type: "refreshed", detail: late })).toBe(closed);
  });

  it("is replaced by another conversation the reader opens", () => {
    const state = stateWith(chat("a"), chat("b"));

    const next = reduce(state, { type: "opened", detail: detail(chat("b"), [message("m9", 9)]) });

    expect(next.thread?.conversation.id).toBe("b");
    expect(next.thread?.messages.map((held) => held.id)).toEqual(["m9"]);
  });
});

describe("the lists read again", () => {
  const counted = { chats: [chat("a", { unread: 2 }), chat("b", { unread: 1 })], requests: [] };

  it("count nothing in the conversation the reader is looking at", () => {
    const state = stateWith(chat("a"), chat("b"));

    const next = reduce(state, {
      type: "listed",
      list: { ...counted, unread: 3 },
      watching: true,
    });

    expect(next.chats.map((row) => row.unread)).toEqual([0, 1]);
    expect(next.thread?.conversation.unread).toBe(0);
    expect(unreadOf(next)).toBe(1);
  });

  it("count what arrived while the reader was away from the screen", () => {
    const state = stateWith(chat("a"), chat("b"));

    const next = reduce(state, {
      type: "listed",
      list: { ...counted, unread: 3 },
      watching: false,
    });

    expect(next.chats.map((row) => row.unread)).toEqual([2, 1]);
  });

  it("leave a first message that waits as the backend counts it", () => {
    const waiting = chat("a", { status: "pending", side: "recipient", canWrite: false });
    const state = stateWith(waiting);

    const next = reduce(state, {
      type: "listed",
      list: { chats: [{ ...waiting, unread: 1 }], requests: [], unread: 1 },
      watching: true,
    });

    expect(next.chats[0].unread).toBe(1);
  });
});
