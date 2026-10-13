"use client";

import { ArrowLeftIcon, InfoIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

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
} from "@/components/ui/message-scroller";
import { initials } from "@/lib/initials";

import { useConversationWords } from "./conversation-words";
import { fromOtherSide, type Thread, type ThreadMessage } from "./messaging-state";

/** The longest message the backend takes. */
const MAX_MESSAGE = 2000;

/** From how many characters on the composer says how many are left. */
const NEAR_LIMIT = 1800;

type ConversationThreadProps = {
  thread: Thread;
  /** False while the stream of events is away. */
  connected: boolean;
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
 * closed, says so.
 */
function ConversationThread({
  thread,
  connected,
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
      <header className="flex items-center gap-3 border-b px-4 py-3 md:px-6">
        <IconButton
          prominence="tertiary"
          size="sm"
          className="lg:hidden"
          aria-label={t("thread.back")}
          onClick={onBack}
        >
          <ArrowLeftIcon aria-hidden="true" />
        </IconButton>
        <Avatar>
          <AvatarFallback>{initials(name, name)}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 flex-1 text-sm">
          <h2 className="truncate font-medium">{name}</h2>
          <p className="truncate text-muted-foreground">
            {[t(`kind.${conversation.kind}`), conversation.subjectName]
              .filter((part) => part !== name)
              .join(" · ")}
          </p>
        </div>
        <IconButton
          prominence="tertiary"
          size="sm"
          className="xl:hidden"
          aria-label={t("details.open")}
          onClick={onDetails}
        >
          <InfoIcon aria-hidden="true" />
        </IconButton>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-2 md:px-6">
        <MessageScrollerProvider autoScroll>
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
            key={conversation.id}
            label={t("composer.label", { name })}
            onSend={onSend}
            onTyping={onTyping}
          />
        ) : conversation.side === "recipient" && conversation.status === "pending" ? (
          <Answer thread={thread} onAccept={onAccept} onRefuse={onRefuse} />
        ) : (
          conversation.status !== "accepted" && (
            <p className="text-sm text-muted-foreground">
              {t(`composer.locked.${conversation.status}`, { name })}
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
                  ? t("thread.seenAt", { time: words.time(message.createdAt) })
                  : words.time(message.createdAt)}
            </span>
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

/** What the end of the conversation says: who is writing, that it waits, or that the stream is away. */
function ThreadState({ thread, connected }: { thread: Thread; connected: boolean }) {
  const t = useTranslations("Messaging");
  const words = useConversationWords();
  const { conversation } = thread;
  const name = words.nameOf(conversation);
  const notes: string[] = [];
  if (
    conversation.status === "pending" &&
    conversation.side === "starter" &&
    conversation.closesAt
  ) {
    notes.push(t("thread.waiting", { name, date: words.date(conversation.closesAt) }));
  }
  if (conversation.status === "pending" && conversation.side === "recipient") {
    notes.push(t("thread.request", { name }));
  }
  if (conversation.status === "declined" || conversation.status === "closed") {
    notes.push(t(`thread.${conversation.status}`, { name }));
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
  onSend,
  onTyping,
}: {
  label: string;
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
