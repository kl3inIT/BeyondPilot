import type {
  Conversation,
  ConversationDetail,
  ConversationList,
  ConversationParticipant,
  ConversationSubject,
  Message,
  MessagingEvent,
} from "@/lib/api/generated";

/** How long a preview in the list runs, as the backend cuts it. */
const PREVIEW = 140;

/**
 * A message on the screen. One the reader just wrote is shown at once, before the backend has kept
 * it: it has no place among the others yet, and says whether it is on its way or did not arrive.
 */
type ThreadMessage = Omit<Message, "seq"> & {
  seq: number | null;
  delivery: "kept" | "sending" | "failed";
};

/** The conversation that is open, with what the screen holds of it. */
type Thread = {
  conversation: Conversation;
  subject: ConversationSubject;
  participants: ConversationParticipant[];
  messages: ThreadMessage[];
  hasEarlier: boolean;
  /** How far the other side has read: the seq of the last message they read. */
  readByOtherSide: number;
  /** Who on the other side is writing now: their name, an empty string when they gave none, or null. */
  typing: string | null;
};

type MessagingState = {
  chats: Conversation[];
  requests: Conversation[];
  thread: Thread | null;
  /**
   * Counts the times the screen heard of something it does not hold, such as a message in a
   * conversation that is not in its list: the list is then read again.
   */
  stale: number;
};

type MessagingAction =
  /**
   * The lists were read. `watching` is whether the reader looks at the open conversation now, so
   * that a list read a moment before they read it does not count it again.
   */
  | { type: "listed"; list: ConversationList; watching: boolean }
  /** A conversation was read to be shown: it takes the place of another one that was open. */
  | { type: "opened"; detail: ConversationDetail }
  /** The open conversation was read again: what the screen holds of it stays. */
  | { type: "refreshed"; detail: ConversationDetail }
  /** Nothing is open any more. */
  | { type: "closed" }
  /** Messages before the first one held were read. */
  | { type: "earlier"; conversationId: string; messages: Message[]; hasMore: boolean }
  /** Messages after the last one held were read, after the stream was away. */
  | { type: "caughtUp"; conversationId: string; messages: Message[]; readByOtherSide: number }
  /**
   * The stream said something happened. `watching` is whether the reader looks at the open
   * conversation now, so that what arrives in it is read, not unread.
   */
  | { type: "heard"; event: MessagingEvent; kind: EventKind; watching: boolean }
  /** The reader sent a message, which is shown before the backend answers. */
  | { type: "sending"; conversationId: string; id: string; body: string; at: string }
  /** The backend kept a message the reader sent. */
  | { type: "kept"; conversationId: string; message: Message }
  /** A message the reader sent did not arrive. */
  | { type: "failed"; id: string }
  /** The reader has read the open conversation to its end. */
  | { type: "read"; conversationId: string }
  /** Nobody is writing any more. */
  | { type: "typingEnded"; conversationId: string };

const eventKinds = ["message", "read", "typing", "conversation"] as const;

type EventKind = (typeof eventKinds)[number];

function initialState(list: ConversationList, detail: ConversationDetail | null): MessagingState {
  return {
    chats: list.chats,
    requests: list.requests,
    thread: detail ? threadOf(detail) : null,
    stale: 0,
  };
}

function threadOf(detail: ConversationDetail): Thread {
  return {
    conversation: detail.conversation,
    subject: detail.subject,
    participants: detail.participants,
    messages: detail.messages.map(kept),
    hasEarlier: detail.hasEarlier,
    readByOtherSide: detail.readByOtherSide,
    typing: null,
  };
}

function kept(message: Message): ThreadMessage {
  return { ...message, delivery: "kept" };
}

/** The start of a message as a row of the list shows it. */
function preview(body: string) {
  const line = body.trim().replace(/\s+/g, " ");
  return line.length <= PREVIEW ? line : `${line.slice(0, PREVIEW - 1).trimEnd()}…`;
}

/** Whether a message was written by the side the reader is not on. */
function fromOtherSide(conversation: Conversation, message: { fromStarter: boolean }) {
  return message.fromStarter !== (conversation.side === "starter");
}

/**
 * The messages with the new ones put in: one already held, by its identifier, is replaced, so a
 * message heard on the stream and answered by the backend is shown once. Those the backend kept
 * stand in its order; those still on their way come last.
 */
function merged(held: ThreadMessage[], incoming: ThreadMessage[]) {
  const byId = new Map(held.map((message) => [message.id, message]));
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  const all = [...byId.values()];
  const arrived = all
    .filter((message) => message.seq !== null)
    .sort((a, b) => (a.seq as number) - (b.seq as number));
  return [...arrived, ...all.filter((message) => message.seq === null)];
}

/**
 * The list with one conversation written in again: it shows the message, counts it when the other
 * side wrote it and the reader is not looking, and moves to the top.
 */
function written(
  chats: Conversation[],
  conversationId: string,
  message: { body: string; mine: boolean; fromStarter: boolean; senderName?: string | null },
  at: string,
  watching: boolean,
) {
  const row = chats.find((chat) => chat.id === conversationId);
  if (!row) {
    return null;
  }
  const unread = fromOtherSide(row, message) && !watching ? row.unread + 1 : row.unread;
  const moved: Conversation = {
    ...row,
    lastMessage: {
      preview: preview(message.body),
      mine: message.mine,
      senderName: message.senderName ?? null,
    },
    lastMessageAt: at,
    unread,
  };
  return [moved, ...chats.filter((chat) => chat.id !== conversationId)];
}

/**
 * The open conversation with a later read of it written in. The read holds the latest messages
 * only, so the earlier ones the reader asked for stay, as does a message heard after the read was
 * taken; what the reader wrote and the backend has not kept yet stays last. The conversation's own
 * fields are those of the read, and how far the other side has read never moves back.
 */
function refreshed(held: Thread, detail: ConversationDetail): Thread {
  const firstHeld = held.messages.find((message) => message.seq !== null)?.seq;
  const firstRead = detail.messages.reduce<number | null>(
    (first, message) => (first === null || message.seq < first ? message.seq : first),
    null,
  );
  // Whether anything comes before what the screen holds is known by whoever read furthest back.
  const heldReachesBack = firstHeld != null && (firstRead === null || firstHeld < firstRead);
  return {
    ...held,
    conversation: detail.conversation,
    subject: detail.subject,
    participants: detail.participants,
    messages: merged(held.messages, detail.messages.map(kept)),
    hasEarlier: heldReachesBack ? held.hasEarlier : detail.hasEarlier,
    readByOtherSide: Math.max(held.readByOtherSide, detail.readByOtherSide),
  };
}

function reduce(state: MessagingState, action: MessagingAction): MessagingState {
  switch (action.type) {
    case "listed": {
      const thread = state.thread;
      const open = thread?.conversation.id;
      // What the reader watches is read: a list read a moment before may still count it.
      const chats = action.list.chats.map((chat) =>
        action.watching && chat.id === open && chat.status === "accepted" && chat.unread > 0
          ? { ...chat, unread: 0 }
          : chat,
      );
      const row = [...chats, ...action.list.requests].find((chat) => chat.id === open);
      return {
        ...state,
        chats,
        requests: action.list.requests,
        thread: thread && row ? { ...thread, conversation: row } : thread,
      };
    }
    case "opened": {
      const held = state.thread;
      return {
        ...state,
        thread:
          held?.conversation.id === action.detail.conversation.id
            ? refreshed(held, action.detail)
            : threadOf(action.detail),
      };
    }
    case "refreshed": {
      const held = state.thread;
      // An answer that arrives after the reader moved on changes nothing.
      if (held?.conversation.id !== action.detail.conversation.id) {
        return state;
      }
      return { ...state, thread: refreshed(held, action.detail) };
    }
    case "closed":
      return { ...state, thread: null };
    case "earlier": {
      const thread = state.thread;
      if (thread?.conversation.id !== action.conversationId) {
        return state;
      }
      return {
        ...state,
        thread: {
          ...thread,
          messages: merged(thread.messages, action.messages.map(kept)),
          hasEarlier: action.hasMore,
        },
      };
    }
    case "caughtUp": {
      const thread = state.thread;
      if (thread?.conversation.id !== action.conversationId) {
        return state;
      }
      return {
        ...state,
        thread: {
          ...thread,
          messages: merged(thread.messages, action.messages.map(kept)),
          readByOtherSide: Math.max(thread.readByOtherSide, action.readByOtherSide),
        },
      };
    }
    case "heard":
      return heard(state, action.event, action.kind, action.watching);
    case "sending": {
      const thread = state.thread;
      if (thread?.conversation.id !== action.conversationId) {
        return state;
      }
      const mine = {
        id: action.id,
        seq: null,
        body: action.body,
        createdAt: action.at,
        mine: true,
        fromStarter: thread.conversation.side === "starter",
        senderName: null,
        delivery: "sending",
      } satisfies ThreadMessage;
      return {
        ...state,
        chats: written(state.chats, action.conversationId, mine, action.at, true) ?? state.chats,
        thread: { ...thread, messages: merged(thread.messages, [mine]) },
      };
    }
    case "kept": {
      const thread = state.thread;
      const chats =
        written(
          state.chats,
          action.conversationId,
          action.message,
          action.message.createdAt,
          true,
        ) ?? state.chats;
      if (thread?.conversation.id !== action.conversationId) {
        return { ...state, chats };
      }
      return {
        ...state,
        chats,
        thread: { ...thread, messages: merged(thread.messages, [kept(action.message)]) },
      };
    }
    case "failed": {
      const thread = state.thread;
      if (!thread) {
        return state;
      }
      return {
        ...state,
        thread: {
          ...thread,
          messages: thread.messages.map((message) =>
            message.id === action.id && message.delivery === "sending"
              ? { ...message, delivery: "failed" }
              : message,
          ),
        },
      };
    }
    case "read":
      return {
        ...state,
        chats: state.chats.map((chat) =>
          chat.id === action.conversationId ? { ...chat, unread: 0 } : chat,
        ),
      };
    case "typingEnded": {
      const thread = state.thread;
      if (thread?.conversation.id !== action.conversationId || thread.typing === null) {
        return state;
      }
      return { ...state, thread: { ...thread, typing: null } };
    }
  }
}

function heard(
  state: MessagingState,
  event: MessagingEvent,
  kind: EventKind,
  watching: boolean,
): MessagingState {
  const thread = state.thread;
  const open = thread?.conversation.id === event.conversationId;
  switch (kind) {
    case "message": {
      const message = event.message;
      if (!message) {
        return state;
      }
      const chats = written(
        state.chats,
        event.conversationId,
        message,
        message.createdAt,
        open && watching,
      );
      if (!chats) {
        // A conversation the list does not hold: the list is read again.
        return { ...state, stale: state.stale + 1 };
      }
      if (!open) {
        return { ...state, chats };
      }
      return {
        ...state,
        chats,
        thread: {
          ...thread,
          messages: merged(thread.messages, [kept(message)]),
          // Whoever sent a message has stopped writing it.
          typing: fromOtherSide(thread.conversation, message) ? null : thread.typing,
        },
      };
    }
    case "read": {
      const seq = event.seq ?? 0;
      const chats = event.mine
        ? state.chats.map((chat) =>
            chat.id === event.conversationId ? { ...chat, unread: 0 } : chat,
          )
        : state.chats;
      if (!open || event.fromStarter === undefined) {
        return { ...state, chats };
      }
      const byOtherSide = fromOtherSide(thread.conversation, { fromStarter: event.fromStarter });
      return {
        ...state,
        chats,
        thread: byOtherSide
          ? { ...thread, readByOtherSide: Math.max(thread.readByOtherSide, seq) }
          : thread,
      };
    }
    case "typing": {
      if (!open || event.fromStarter === undefined) {
        return state;
      }
      // Only the other side's writing is shown: a colleague's is not what the reader waits for.
      if (!fromOtherSide(thread.conversation, { fromStarter: event.fromStarter })) {
        return state;
      }
      return { ...state, thread: { ...thread, typing: event.name ?? "" } };
    }
    case "conversation":
      // It started, was answered or closed: the list, and the conversation when it is open, are read again.
      return { ...state, stale: state.stale + 1 };
  }
}

/** How many messages the reader has not read across the open conversations. */
function unreadOf(state: MessagingState) {
  return state.chats.reduce((sum, chat) => sum + chat.unread, 0);
}

export {
  eventKinds,
  fromOtherSide,
  initialState,
  reduce,
  unreadOf,
  type EventKind,
  type MessagingAction,
  type MessagingState,
  type Thread,
  type ThreadMessage,
};
