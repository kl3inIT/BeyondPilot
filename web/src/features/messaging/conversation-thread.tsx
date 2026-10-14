"use client";

import { InfoIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useAppForm } from "@/components/form/app-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerScrollable,
} from "@/components/ui/message-scroller";
import { initials } from "@/lib/initials";

import { useConversationWords } from "./conversation-words";
import { fromOtherSide, type Thread, type ThreadMessage } from "./messaging-state";
import { ThreadHeader } from "./thread-header";

/** The longest message the backend takes. */
const MAX_MESSAGE = 2000;

/** From how many characters on the composer says how many are left. */
const NEAR_LIMIT = 1800;

type ConversationThreadProps = {
  thread: Thread;
  /** False once the stream of events was lost, until it is back. */
  connected: boolean;
  /** The heading and the composer, for the screen to move the focus to when the conversation opens. */
  headingRef: React.Ref<HTMLHeadingElement>;
  composerRef: React.Ref<HTMLTextAreaElement>;
  onBack: () => void;
  onDetails: () => void;
  onSend: (body: string) => void;
  onRetry: (id: string) => void;
  onTyping: () => void;
  onEarlier: () => Promise<void>;
  onAccept: () => Promise<void>;
  onRefuse: (how: "decline" | "report") => Promise<void>;
};

/**
 * One conversation: who it is with, its messages from the oldest to the newest, and under them
 * what the reader may do now. In an open conversation that is the composer; a first message that
 * waits for the reader has its answers; one that waits for the other side, or was declined or
 * closed, says so there, once.
 *
 * The screen keys it by the conversation, so where the reader had scrolled to and an answer they
 * were asked to confirm belong to one conversation and never show in the next.
 */
/**
 * Keeps what was just written in view for a reader who is at the end of the conversation, and always
 * for what the reader wrote. The scroller follows the end by itself only while it holds that it is
 * following, and it stops holding so after a wheel or a key at the end, or after the tab was behind
 * another one: a message that arrived then stayed under the edge. A reader who scrolled up to read
 * is left where they are, with the button that leads to the newest message.
 */
function FollowNewest({ newest, mine }: { newest: string; mine: boolean }) {
  const { scrollToEnd } = useMessageScroller();
  const { end: more } = useMessageScrollerScrollable();
  const atEnd = useRef(true);
  const followed = useRef(newest);
  useEffect(() => {
    if (newest === followed.current) {
      // Nothing was written: only where the reader is has changed.
      atEnd.current = !more;
      return;
    }
    followed.current = newest;
    if (mine || atEnd.current) {
      scrollToEnd();
    }
  }, [newest, mine, more, scrollToEnd]);
  return null;
}

function ConversationThread({
  thread,
  connected,
  headingRef,
  composerRef,
  onBack,
  onDetails,
  onSend,
  onRetry,
  onTyping,
  onEarlier,
  onAccept,
  onRefuse,
}: ConversationThreadProps) {
  const t = useTranslations("Messaging");
  const words = useConversationWords();
  const { conversation, messages } = thread;
  const name = words.nameOf(conversation);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  /** The last message of the reader's side that the other side has read. */
  const seen = messages.findLast(
    (message) =>
      message.seq !== null &&
      message.seq <= thread.readByOtherSide &&
      !fromOtherSide(conversation, message),
  )?.id;

  async function earlier() {
    setLoadingEarlier(true);
    await onEarlier();
    setLoadingEarlier(false);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ThreadHeader
        name={name}
        about={{ kind: conversation.kind, name: conversation.subjectName }}
        onBack={onBack}
        headingRef={headingRef}
      >
        <IconButton
          prominence="tertiary"
          size="sm"
          className="xl:hidden"
          aria-label={t("details.open")}
          onClick={onDetails}
        >
          <InfoIcon aria-hidden="true" />
        </IconButton>
      </ThreadHeader>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-2 md:px-6">
        <MessageScrollerProvider autoScroll>
          <FollowNewest
            newest={`${messages.at(-1)?.id ?? ""}${thread.typing ? "+" : ""}`}
            mine={messages.at(-1)?.mine ?? false}
          />
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent>
                {thread.hasEarlier && (
                  <MessageScrollerItem messageId="earlier">
                    <div className="flex justify-center">
                      <Button
                        prominence="tertiary"
                        size="sm"
                        pending={loadingEarlier}
                        onClick={() => void earlier()}
                      >
                        {t("thread.earlier")}
                      </Button>
                    </div>
                  </MessageScrollerItem>
                )}
                {!thread.hasEarlier && (
                  <MessageScrollerItem messageId="about">
                    <Marker variant="separator">
                      <MarkerContent>
                        {t("thread.about", { subject: conversation.subjectName })}
                      </MarkerContent>
                    </Marker>
                  </MessageScrollerItem>
                )}
                {messages.map((message, index) => {
                  const before = messages[index - 1];
                  const newDay = !before || !words.sameDay(before.createdAt, message.createdAt);
                  return (
                    <MessageScrollerItem key={message.id} messageId={message.id}>
                      <div className="flex flex-col gap-4">
                        {newDay && (
                          <Marker variant="separator">
                            <MarkerContent>{words.dayName(message.createdAt)}</MarkerContent>
                          </Marker>
                        )}
                        <ThreadRow
                          thread={thread}
                          message={message}
                          seen={message.id === seen}
                          onRetry={onRetry}
                        />
                      </div>
                    </MessageScrollerItem>
                  );
                })}
                <MessageScrollerItem messageId="state">
                  <ThreadState thread={thread} connected={connected} />
                </MessageScrollerItem>
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton aria-label={t("thread.latest")} />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>
      <div className="border-t px-4 py-3 md:px-6">
        {conversation.canWrite ? (
          <Composer
            label={t("composer.label", { name })}
            inputRef={composerRef}
            onSend={onSend}
            onTyping={onTyping}
          />
        ) : conversation.side === "recipient" && conversation.status === "pending" ? (
          <Answer thread={thread} onAccept={onAccept} onRefuse={onRefuse} />
        ) : (
          conversation.status !== "accepted" && (
            <p className="text-sm text-muted-foreground">
              {[
                t(`composer.locked.${conversation.status}`, { name }),
                conversation.status === "pending" && conversation.closesAt
                  ? t("composer.closes", { date: words.date(conversation.closesAt) })
                  : null,
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
          )
        )}
      </div>
    </div>
  );
}

/** One message as the reader sees it: on their own side or the other, with who wrote it and when. */
function ThreadRow({
  thread,
  message,
  seen,
  onRetry,
}: {
  thread: Thread;
  message: ThreadMessage;
  seen: boolean;
  onRetry: (id: string) => void;
}) {
  const t = useTranslations("Messaging");
  const words = useConversationWords();
  const { conversation } = thread;
  const other = fromOtherSide(conversation, message);
  // One person answers for a talent profile, so their name is in the header of the conversation.
  const named = other ? conversation.kind !== "talent" : !message.mine;
  const writer =
    message.senderName ??
    (conversation.kind === "program" && !message.fromStarter ? t("genaiFund") : t("someone"));

  return (
    <Message align={other ? "start" : "end"}>
      {other && (
        <MessageAvatar>
          <Avatar>
            <AvatarFallback>{initials(writer, writer)}</AvatarFallback>
          </Avatar>
        </MessageAvatar>
      )}
      <MessageContent>
        {named && <MessageHeader>{writer}</MessageHeader>}
        <Bubble variant={other ? "muted" : "default"} align={other ? "start" : "end"}>
          <BubbleContent>
            <span className="whitespace-pre-line">{message.body}</span>
          </BubbleContent>
        </Bubble>
        <MessageFooter>
          {message.delivery === "failed" ? (
            <span role="alert" className="flex items-center gap-2 text-destructive">
              {t("thread.failed")}
              <TextButton onClick={() => onRetry(message.id)}>{t("thread.retry")}</TextButton>
            </span>
          ) : (
            <span className="tabular-nums">
              {message.delivery === "sending"
                ? t("thread.sending")
                : seen
                  ? // The backend keeps how far the other side has read, not when they read it.
                    t("thread.seen")
                  : words.time(message.createdAt)}
            </span>
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

/**
 * What the end of the conversation says: that the other side does not know the reader has read a
 * first message, who is writing, or that the stream was lost. Why nothing can be written is said
 * once, where the composer would be.
 */
function ThreadState({ thread, connected }: { thread: Thread; connected: boolean }) {
  const t = useTranslations("Messaging");
  const words = useConversationWords();
  const { conversation } = thread;
  const name = words.nameOf(conversation);
  const notes: string[] = [];
  if (conversation.status === "pending" && conversation.side === "recipient") {
    notes.push(t("thread.request", { name }));
  }
  if (thread.typing !== null) {
    notes.push(
      thread.typing ? t("thread.typing", { name: thread.typing }) : t("thread.typingSomeone"),
    );
  }
  if (!connected) {
    notes.push(t("thread.reconnecting"));
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {notes.map((note) => (
        <Marker key={note}>
          <MarkerContent>{note}</MarkerContent>
        </Marker>
      ))}
    </div>
  );
}

/**
 * Where a message is written: Enter sends it, Shift and Enter start a new line. What was written
 * stays when `onSend` answers false, as a first message does when the backend refuses it.
 */
function Composer({
  label,
  inputRef,
  onSend,
  onTyping,
}: {
  label: string;
  /** The field, for the screen to move the focus to. */
  inputRef?: React.Ref<HTMLTextAreaElement>;
  onSend: (body: string) => void | Promise<boolean>;
  onTyping?: () => void;
}) {
  const t = useTranslations("Messaging");
  const form = useAppForm({
    defaultValues: { body: "" },
    onSubmit: async ({ value, formApi }) => {
      const body = value.body.trim();
      if (body && (await onSend(body)) !== false) {
        formApi.reset();
      }
    },
  });

  return (
    <form
      id={form.formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="body">
        {(field) => (
          <div className="flex flex-col gap-1">
            <InputGroup>
              <InputGroupTextarea
                ref={inputRef}
                rows={1}
                className="max-h-40 min-h-9"
                aria-label={label}
                placeholder={label}
                maxLength={MAX_MESSAGE}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  onTyping?.();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void form.handleSubmit();
                  }
                }}
              />
              <InputGroupAddon align="inline-end">
                {/* Never disabled: the group fades whole around a disabled control, and the words
                    in the field would then be too faint to read. Sending nothing does nothing. */}
                <InputGroupButton
                  type="submit"
                  variant="default"
                  size="icon-sm"
                  aria-label={t("composer.send")}
                >
                  <SendIcon aria-hidden="true" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {field.state.value.length >= NEAR_LIMIT && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("composer.left", { count: MAX_MESSAGE - field.state.value.length })}
              </p>
            )}
          </div>
        )}
      </form.Field>
    </form>
  );
}

/** The answers to a first message: accept it, decline it, or report it as unwanted. */
function Answer({
  thread,
  onAccept,
  onRefuse,
}: {
  thread: Thread;
  onAccept: () => Promise<void>;
  onRefuse: (how: "decline" | "report") => Promise<void>;
}) {
  const t = useTranslations("Messaging.answer");
  const words = useConversationWords();
  const name = words.nameOf(thread.conversation);
  const [asked, setAsked] = useState<"decline" | "report" | null>(null);
  const [pending, setPending] = useState<"accept" | "refuse" | null>(null);

  if (!thread.conversation.canAnswer) {
    return <p className="text-sm text-muted-foreground">{t("ownersOnly")}</p>;
  }

  async function run(what: "accept" | "refuse", action: () => Promise<void>) {
    setPending(what);
    try {
      await action();
      setAsked(null);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button prominence="tertiary" disabled={pending !== null} onClick={() => setAsked("report")}>
        {t("report")}
      </Button>
      <Button
        prominence="secondary"
        disabled={pending !== null}
        onClick={() => setAsked("decline")}
      >
        {t("decline")}
      </Button>
      <Button pending={pending === "accept"} onClick={() => void run("accept", onAccept)}>
        {t("accept")}
      </Button>
      <ConfirmDialog
        open={asked !== null}
        onOpenChange={(open) => !open && setAsked(null)}
        title={t(asked === "report" ? "reportTitle" : "declineTitle", { name })}
        description={t(asked === "report" ? "reportLead" : "declineLead", { name })}
        note={t("final")}
        confirmLabel={t(asked === "report" ? "report" : "decline")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending === "refuse"}
        onConfirm={() => asked && void run("refuse", () => onRefuse(asked))}
      />
    </div>
  );
}

export { Composer, ConversationThread };
